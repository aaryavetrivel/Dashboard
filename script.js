(function(){
var N=120,cfg={tw:70,ta:90,cw:3.2,ca:4.5,vw:30,va:60,rn:45,dia:127,sl:50,rr:1,ip:"192.168.1.37",mode:"demo",calMode:"auto",sens:"normal"};
try{var s0=JSON.parse(localStorage.getItem("cv-cfg-2")||"{}");for(var k in s0)cfg[k]=s0[k];}catch(e){}
var $=function(i){return document.getElementById(i)};
var H={temp:[],cur:[],vib:[],rpm:[],rpm2:[]},rows=[],dist=0,lastLvl={},last=null,fault=0,ftype="slip",simT=42,tick=0,candKey=null,candN=0,dx={key:"wait",hit:null,bad:[]},motorSpeed=60,motorState="S",autoStopLatched=false,motorCommandBusy=false;
var IDS=["tw","ta","cw","ca","vw","va","rn","sl","rr","dia"];
IDS.forEach(function(k){$(k).value=cfg[k]});$("ip").value=cfg.ip;
function persist(){try{localStorage.setItem("cv-cfg-2",JSON.stringify(cfg))}catch(e){}}

var TXT={c:{N:"Normal",U:"Slightly up",H:"Spikes high"},t:{N:"Normal",R:"Rises"},v:{N:"Normal",E:"Elevated"},r:{N:"Normal",D:"Drops",Z:"Drops to zero"}};
var RULES=[
{id:"slip",name:"Belt slip",c:"NU",t:"N",v:"E",r:"D",lv:2,why:"The drive roller turns but the second roller lags behind, and the belt is shaking.",chk:"belt tension, drive-roller lagging, and oil or dust on the belt."},
{id:"jam",name:"Jam or blockage",c:"H",t:"R",v:"E",r:"Z",lv:2,why:"Current spiked, the motor is heating up and the belt has stopped.",chk:"stop the motor and clear the obstruction before restarting."},
{id:"bear",name:"Bearing wear",c:"NU",t:"R",v:"E",r:"N",lv:1,why:"Belt speed is normal, but the motor runs hotter with more vibration.",chk:"bearing noise, temperature and lubrication."},
{id:"mis",name:"Misalignment",c:"N",t:"N",v:"E",r:"N",lv:1,why:"Only vibration is elevated. Everything else is normal.",chk:"roller and pulley alignment and belt tracking."},
{id:"over",name:"Motor overload (no jam)",c:"H",t:"R",v:"N",r:"N",lv:2,why:"Current is high and the motor is heating up, but the belt still moves.",chk:"the load on the belt against the motor rating, then reduce the load."}];
function txt(col,set){return set.split("").map(function(x){return TXT[col][x]}).join(" / ")}
(function(){var h='<tr><th>Fault</th><th>Current</th><th>Motor temp</th><th>Vibration</th><th>RPM (hall)</th></tr><tr id="rNow" class="now"><td>Right now</td><td></td><td></td><td></td><td></td></tr>';
RULES.forEach(function(r){h+='<tr id="r_'+r.id+'"><td>'+r.name+'</td><td>'+txt("c",r.c)+'</td><td>'+txt("t",r.t)+'</td><td>'+txt("v",r.v)+'</td><td>'+txt("r",r.r)+'</td></tr>'});
$("dxTbl").innerHTML=h})();

function lvl(v,w,a){return v>=a?2:v>=w?1:0}
function log(msg,l){
  var d=document.createElement("div"),t=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  d.innerHTML='<span class="t num">'+t+'</span><span class="dot s'+l+'" style="margin-top:6px"></span><span>'+msg+'</span>';
  var L=$("log");if(L.children.length===1&&L.textContent.indexOf("No alerts")>-1)L.innerHTML="";
  L.insertBefore(d,L.firstChild);
}
function check(key,name,l,v,u){
  if(lastLvl[key]===l)return;
  if(lastLvl[key]!==undefined||l>0)log(l===0?name+" back to normal":name+(l===2?" is at alarm level: ":" is high: ")+v+" "+u,l);
  lastLvl[key]=l;
}
function push(a,v){a.push(v);if(a.length>N)a.shift()}

function draw(id,arr,color,warn,alarm,arr2){
  var c=$(id),dpr=window.devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;
  c.width=w*dpr;c.height=h*dpr;var g=c.getContext("2d");g.scale(dpr,dpr);
  var st=getComputedStyle(document.documentElement),col=st.getPropertyValue(color).trim(),ln=st.getPropertyValue("--line").trim(),bad=st.getPropertyValue("--bad").trim(),wr=st.getPropertyValue("--warn").trim(),mu=st.getPropertyValue("--mute").trim();
  if(!arr.length)return;
  var all=arr.concat(arr2||[]),mx=Math.max.apply(null,all),mn=Math.min.apply(null,all);
  if(alarm!=null)mx=Math.max(mx,alarm*1.05);
  mn=Math.min(mn,0);if(mx-mn<1)mx=mn+1;
  var y=function(v){return h-4-(v-mn)/(mx-mn)*(h-8)};
  g.strokeStyle=ln;g.lineWidth=1;g.beginPath();g.moveTo(0,h-.5);g.lineTo(w,h-.5);g.stroke();
  g.setLineDash([4,4]);
  [[warn,wr],[alarm,bad]].forEach(function(p){if(p[0]!=null){g.strokeStyle=p[1];g.beginPath();g.moveTo(0,y(p[0]));g.lineTo(w,y(p[0]));g.stroke()}});
  g.setLineDash([]);
  [[arr2,mu,1.5],[arr,col,2]].forEach(function(p){if(!p[0])return;g.strokeStyle=p[1];g.lineWidth=p[2];g.lineJoin="round";g.beginPath();
    p[0].forEach(function(v,i){var x=i/(N-1)*w;i?g.lineTo(x,y(v)):g.moveTo(x,y(v))});g.stroke()});
}
function drawAll(){draw("gTemp",H.temp,"--c-temp",cfg.tw,cfg.ta);draw("gCur",H.cur,"--c-cur",cfg.cw,cfg.ca);draw("gVib",H.vib,"--c-vib",cfg.vw,cfg.va);draw("gRpm",H.rpm,"--c-spd",cfg.rn*.85,null,H.rpm2)}

function states(d,vib){
  var slip=d.rpm>=5?(1-d.rpm2/d.rpm/(cfg.rr||1))*100:0;
  return{c:d.current>=cfg.ca?"H":d.current>=cfg.cw?"U":"N",t:d.temp>=cfg.tw?"R":"N",v:vib>=cfg.vw?"E":"N",slip:slip,r:d.rpm<5?"Z":(d.rpm<cfg.rn*.85||slip>=cfg.sl)?"D":"N"};
}
// Physical motor commands are allowed only in Live ESP32 mode.
function esp32Base(){
  var ip=(cfg.ip||"").trim().replace(/^https?:\/\//,"").replace(/\/$/,"");
  return ip ? "http://"+ip : "";
}
function updateMotorUI(){
  var liveMode=cfg.mode==="live";
  ["motorStart","speedDown","speedUp"].forEach(function(id){$(id).disabled=!liveMode||motorCommandBusy||autoStopLatched});
  $("motorStop").disabled=!liveMode||motorCommandBusy;
  $("motorAck").disabled=!liveMode||motorCommandBusy||!autoStopLatched;
  $("motorSpeed").textContent=String(motorSpeed);
  $("motorPillText").textContent=autoStopLatched?"Fault stop latched":(motorState==="F"?"Running":motorState==="S"?"Stopped":"Motor active");
  $("motorPill").className="pill "+(autoStopLatched?"s2":motorState==="F"||motorState==="B"?"s0":"");
  if(!liveMode)$("motorStatus").textContent="Switch to Live ESP32 to control the physical motor. Demo mode never sends motor commands.";
  else if(autoStopLatched)$("motorStatus").textContent="ESP32 fault interlock is latched. Clear the physical fault, then press Acknowledge fault.";
  else $("motorStatus").textContent="Live ESP32 control. Current command state: "+(motorState==="F"?"Forward":motorState==="B"?"Backward":"Stopped")+".";
}
function motorCommand(cmd,automatic){
  if(cfg.mode!=="live"||motorCommandBusy)return Promise.resolve(false);
  if(autoStopLatched&&!automatic&&cmd!=="S")return Promise.resolve(false);
  motorCommandBusy=true;updateMotorUI();
  var url=esp32Base()+"/motor?cmd="+encodeURIComponent(cmd);
  return fetch(url,{method:"GET",cache:"no-store"}).then(function(r){
    if(!r.ok)throw new Error("ESP32 returned HTTP "+r.status);
    return r.json();
  }).then(function(j){
    if(j.ok===false)throw new Error(j.error||"Motor command rejected");
    if(j.speed!=null)motorSpeed=Number(j.speed);
    if(j.state!=null)motorState=String(j.state);
    log("Motor command sent: "+(cmd==="F"?"START":cmd==="S"?"STOP":cmd==="+"?"INCREASE SPEED":cmd==="-"?"DECREASE SPEED":cmd),automatic?2:0);
    return true;
  }).catch(function(e){
    log("Motor command failed: "+e.message+". Check the ESP32 IP and browser network permissions.",2);
    $("motorStatus").textContent="Command failed. Verify ESP32 address and connection.";
    return false;
  }).then(function(ok){motorCommandBusy=false;updateMotorUI();return ok;});
}
function automaticFaultStop(){
  if(cfg.mode!=="live"||autoStopLatched)return;
  autoStopLatched=true;
  $("motorNotice").textContent="FAULT DETECTED: stop command sent. Restart is locked until you acknowledge the stop and the readings return to normal.";
  log("FAULT INTERLOCK: requesting motor stop",2);
  motorCommand("S",true);
  updateMotorUI();
}

function diagnose(d,s){
  var on=d.current>=0.5||d.rpm>=5,hit=null,bad=[];
  if(on){
    RULES.forEach(function(r){if(!hit&&r.c.indexOf(s.c)>-1&&r.t===s.t&&r.v===s.v&&r.r.indexOf(s.r)>-1)hit=r});
    if(s.c!=="N")bad.push("current");if(s.t!=="N")bad.push("motor temperature");if(s.v!=="N")bad.push("vibration");if(s.r!=="N")bad.push("roller speed");
  }
  var key=!on?"idle":hit?hit.id:bad.length?"unk:"+bad.join():"ok";
  if(key===candKey)candN++;else{candKey=key;candN=1}
  // a diagnosis must hold for 3 readings in a row, so one noisy sample does not raise an alert
  if(candN>=3&&key!==dx.key){
    var prev=dx.key;dx={key:key,hit:hit,bad:bad};
    if(hit)log("Likely "+hit.name.toLowerCase()+". "+hit.why,hit.lv);
    else if(bad.length)log("Unusual readings in "+bad.join(", ")+", no known fault pattern matches",1);
    else if(prev!=="idle"&&prev!=="ok"&&prev!=="wait")log("Readings back to normal",0);
  }
  var lv=0,name,why,chk="";
  if(dx.key==="wait"){name="Checking sensors…";why="Waiting for a few readings."}
  else if(dx.key==="idle"){name="Belt idle";why="The motor is off, so faults are not checked."}
  else if(dx.key==="ok"){name="No fault detected";why="Current, temperature, vibration and rpm are all in their normal range."}
  else if(dx.hit){name=dx.hit.name;why=dx.hit.why;chk="Check "+dx.hit.chk;lv=dx.hit.lv}
  else{name="Unusual readings";why="Outside normal range: "+dx.bad.join(", ")+". This does not match a known fault.";chk="Inspect the belt and motor by hand.";lv=1}
  $("dxName").textContent=name;$("dxWhy").textContent=why;$("dxChk").textContent=chk;
  $("dxDot").className="dot"+((dx.key==="idle"||dx.key==="wait")?"":" s"+lv);
  var tr=$("dxTbl").rows;for(var i=0;i<tr.length;i++)tr[i].classList.remove("hit");
  if(dx.hit)$("r_"+dx.hit.id).classList.add("hit");
  var nc=$("rNow").children;
  nc[1].textContent=on?TXT.c[s.c]:"Idle";nc[2].textContent=on?TXT.t[s.t]:"Idle";nc[3].textContent=on?TXT.v[s.v]:"Idle";nc[4].textContent=on?TXT.r[s.r]:"Idle";
  return dx.key==="idle"||dx.key==="wait"||dx.key==="ok"?(dx.key==="ok"?0:-1):lv;
}

function render(){
  var d=last;if(!d)return;
  var vib=Math.sqrt(d.gx*d.gx+d.gy*d.gy+d.gz*d.gz),spd=d.rpm*Math.PI*cfg.dia/1000/60,s=states(d,vib);
  dist+=spd; // runs once per second
  push(H.temp,d.temp);push(H.cur,d.current);push(H.vib,vib);push(H.rpm,d.rpm);push(H.rpm2,d.rpm2);
  rows.push([new Date().toISOString(),d.temp,d.current,d.gx,d.gy,d.gz,vib.toFixed(2),d.rpm,d.rpm2,s.slip.toFixed(1)]);if(rows.length>5000)rows.shift();
  $("vTemp").textContent=d.temp.toFixed(1);
  $("vCur").textContent=d.current.toFixed(2);$("vVib").textContent=vib.toFixed(1);$("vRpm").textContent=Math.round(d.rpm);$("vRpm2").textContent=Math.round(d.rpm2);$("vSlip").textContent=s.slip.toFixed(1);
  $("gx").textContent=d.gx.toFixed(1);$("gy").textContent=d.gy.toFixed(1);$("gz").textContent=d.gz.toFixed(1);
  $("spd").textContent=spd.toFixed(2);$("rpm").textContent=Math.round(d.rpm);$("cnt").textContent=dist.toFixed(1);
  var lt=Math.max(lvl(d.temp,cfg.tw,cfg.ta),s.t==="R"?1:0),lc=lvl(d.current,cfg.cw,cfg.ca),lv=lvl(vib,cfg.vw,cfg.va),ld=diagnose(d,s);
  if(cfg.mode==="demo" && dx.key!=="idle"&&dx.key!=="wait"&&dx.key!=="ok") { /* demo faults are visual only */ }
  if(dx.key==="ok"&&autoStopLatched){$("motorNotice").textContent="Readings are back to normal, but the motor remains locked off. Press Stop to acknowledge, then Start when safe.";}
  var lr=s.r==="N"?0:(d.current>=0.5?1:0);
  [["cTemp",lt],["cCur",lc],["cVib",lv],["cRpm",lr]].forEach(function(p){var e=$(p[0]);e.className="card s"+p[1];e.querySelector(".dot").className="dot s"+p[1]});
  check("t","Motor temperature",lt,d.temp.toFixed(1),"°C");check("c","Motor current",lc,d.current.toFixed(2),"A");check("v","Vibration",lv,vib.toFixed(1),"°/s");
  var w=Math.max(lt,lc,lv,ld,0);
  $("state").className="pill s"+w;$("stateTxt").textContent=w===2?"Fault":w===1?"Warning":dx.key==="idle"?"Idle":"Running";
  var tk=$("track");
  if(spd>0.01)tk.style.animation="mv "+Math.min(4,Math.max(.2,.3/spd))+"s linear infinite";else tk.style.animation="none";
  calStep(d,vib);
  drawAll();
}
var stl=document.createElement("style");stl.textContent="@keyframes mv{from{background-position:0 0}to{background-position:30px 0}}";document.head.appendChild(stl);

function sim(){
  tick++;
  var cur=2.4+Math.sin(tick/20)*.4+Math.random()*.2,rpm=118+Math.random()*3,j=6,tgt=42,k=.98;
  if(fault>0){fault--;
    if(ftype==="slip"){k=.68;j=110;cur=2.9}
    if(ftype==="jam"){cur=5.6;rpm=0;j=110;tgt=95}
    if(ftype==="bear"){cur=3.0;j=110;tgt=95}
    if(ftype==="mis"){j=110}
    if(ftype==="over"){cur=5.4;tgt=95}
  }
  simT+=(tgt-simT)*(tgt>60?.06:.03)+(Math.random()-.5)*.3;
  return{temp:simT,current:cur,gx:(Math.random()-.5)*j,gy:(Math.random()-.5)*j,gz:(Math.random()-.5)*j,rpm:rpm,rpm2:rpm*k+Math.random()};
}
function live(){
  var base=cfg.ip?("http://"+cfg.ip.replace(/^https?:\/\//,"")):"";
  return fetch(base+"/data",{cache:"no-store"}).then(function(r){return r.json()}).then(function(j){
    var m=j.mpu||{},pick=function(){for(var i=0;i<arguments.length;i++)if(arguments[i]!=null&&!isNaN(+arguments[i]))return +arguments[i];return null};
    var v={temp:pick(j.temp,j.temperature),current:pick(j.current),gx:pick(j.gx,m.gx),gy:pick(j.gy,m.gy),gz:pick(j.gz,m.gz),rpm:pick(j.rpm,j.rpm1,j.hall1Rpm),rpm2:pick(j.rpm2,j.hall2Rpm)};
    var miss=Object.keys(v).filter(function(k){return v[k]===null});
    last={temp:v.temp!=null?v.temp:0,current:v.current||0,gx:v.gx||0,gy:v.gy||0,gz:v.gz||0,rpm:v.rpm||0,rpm2:v.rpm2!=null?v.rpm2:(v.rpm||0)};
    if(j.motor){if(j.motor.state!=null)motorState=String(j.motor.state);if(j.motor.speed!=null)motorSpeed=Number(j.motor.speed);}
    if(j.fault && j.fault.latched){
      if(!autoStopLatched)log("ESP32 FAULT INTERLOCK: "+(j.fault.reason||"fault detected")+". Motor stopped locally.",2);
      autoStopLatched=true;
      $("motorNotice").textContent="ESP32 fault stop: "+(j.fault.reason||"fault detected")+". Clear the fault physically, then acknowledge.";
    }
    if(j.fault && !j.fault.latched && autoStopLatched){
      // Do not silently clear the dashboard lockout; the operator must acknowledge.
    }
    updateMotorUI();
    var msg="Connected to "+(cfg.ip||location.host)+". ";
    if(miss.length)msg+="Missing: "+miss.join(", ")+(miss.indexOf("rpm")>-1?". The ESP32 must send hall speeds as rpm, not 0/1 states":"")+". ";
    else msg+="All fields received. ";
    $("conn").textContent=msg;render();
  }).catch(function(){
    $("conn").textContent="Cannot reach ESP32 at "+(cfg.ip||location.host)+". Check the address, Wi-Fi, and that the ESP32 sends CORS headers.";
    $("state").className="pill s1";$("stateTxt").textContent="No data";
  });
}
setInterval(function(){
  if(cfg.mode==="demo"){last=sim();$("conn").textContent="Demo data, no ESP32 connected";render()}else live();
},1000);

var cal=null,CAL_N=10,SENS={tight:[1.2,1.5,3,5,10,20],normal:[1.3,1.8,4,8,15,30],loose:[1.5,2.2,5,12,20,40]};
function applyMode(){
  var a=cfg.calMode==="auto";
  $("modeAuto").className=a?"on":"";$("modeMan").className=a?"":"on";
  if(a)IDS.forEach(function(k){$(k).value=cfg[k]});
  IDS.forEach(function(k){$(k).disabled=a});$("sens").disabled=!a;$("sens").value=cfg.sens;$("cal").disabled=!a;
  $("cal").title=a?"Run the belt normally and learn its baseline":"Switch Limits to Automatic to use calibration";
  $("modeNote").textContent=a?"Automatic: press Calibrate with the belt running normally and no fault. It sets every limit from what it measures. Sensitivity sets how far above normal each limit sits.":"Manual: type your own limits and press Save.";
}
$("modeAuto").onclick=function(){cfg.calMode="auto";persist();applyMode()};
$("modeMan").onclick=function(){cfg.calMode="manual";persist();applyMode()};
$("sens").onchange=function(){cfg.sens=this.value;persist()};
applyMode();
function calBtn(t){$("cal").textContent=t}
function calStop(msg){cal=null;calBtn("Calibrate");log(msg,1)}
function calStep(d,vib){
  if(!cal)return;
  if(d.current<0.5||d.rpm<5||(dx.key!=="ok"&&dx.key!=="wait"))return calStop("Calibration cancelled. The belt must be running normally with no fault.");
  cal.n++;cal.c+=d.current;cal.r+=d.rpm;cal.v+=vib;cal.t+=d.temp;cal.s+=d.rpm2/d.rpm;
  if(cal.n<CAL_N)return calBtn("Calibrating… "+(CAL_N-cal.n)+"s");
  var c=cal.c/CAL_N,r=cal.r/CAL_N,v=cal.v/CAL_N,t=cal.t/CAL_N,s=cal.s/CAL_N,m=SENS[cfg.sens]||SENS.normal;
  cfg.rn=Math.round(r);cfg.cw=Math.round(c*m[0]*10)/10;cfg.ca=Math.round(c*m[1]*10)/10;cfg.vw=Math.max(8,Math.round(v*m[2]));cfg.va=cfg.vw*2;
  cfg.rr=Math.round(s*1000)/1000||1;cfg.sl=m[3];cfg.tw=Math.round(t+m[4]);cfg.ta=Math.round(t+m[5]);
  IDS.forEach(function(k){$(k).value=cfg[k]});persist();cal=null;calBtn("Calibrate");
  log("Calibrated ("+cfg.sens+" sensitivity). Limits set: motor temp "+cfg.tw+"/"+cfg.ta+" °C, current "+cfg.cw+"/"+cfg.ca+" A, vibration "+cfg.vw+"/"+cfg.va+" °/s, rpm "+cfg.rn+", slip limit "+cfg.sl+"%",0);
}
$("cal").onclick=function(){if(cal)return calStop("Calibration stopped.");cal={n:0,c:0,r:0,v:0,t:0,s:0};calBtn("Calibrating… "+CAL_N+"s")};
$("reset").onclick=function(){
  if(!confirm("Clear graphs, alerts, distance and logged data? Your settings are kept."))return;
  H={temp:[],cur:[],vib:[],rpm:[],rpm2:[]};rows=[];dist=0;lastLvl={};fault=0;candKey=null;candN=0;dx={key:"wait",hit:null,bad:[]};
  cal=null;calBtn("Calibrate");
  ["gTemp","gCur","gVib","gRpm"].forEach(function(id){var c=$(id);c.width=c.width});
  $("cnt").textContent="0.0";$("log").innerHTML='<div><span class="t">--</span><span>No alerts yet.</span></div>';
};
function setMode(m){cfg.mode=m;$("mDemo").className=m==="demo"?"on":"";$("mLive").className=m==="live"?"on":"";
  if(m==="live")$("conn").textContent="Connecting…";persist();updateMotorUI()}
setMode(cfg.mode);
$("mDemo").onclick=function(){setMode("demo")};$("mLive").onclick=function(){setMode("live")};
$("motorStart").onclick=function(){
  if(autoStopLatched){log("Start blocked: acknowledge the fault stop and confirm the fault is cleared first.",2);return;}
  motorCommand("F",false);
};
$("motorStop").onclick=function(){
  motorCommand("S",false).then(function(ok){if(ok){$("motorNotice").textContent="Motor stopped. This does not reset a fault latch.";updateMotorUI();}});
};
$("motorAck").onclick=function(){
  if(!confirm("Only acknowledge after inspecting the conveyor and clearing the physical fault. Continue?"))return;
  motorCommand("R",false).then(function(ok){
    if(ok){autoStopLatched=false;$("motorNotice").textContent="Fault acknowledged. Start only when the conveyor is safe.";updateMotorUI();}
  });
};
$("speedUp").onclick=function(){motorCommand("+",false)};
$("speedDown").onclick=function(){motorCommand("-",false)};
updateMotorUI();

$("fault").onclick=function(){if(cfg.mode!=="demo")setMode("demo");ftype=$("fsel").value;fault=25};
$("clr").onclick=function(){$("log").innerHTML='<div><span class="t">--</span><span>No alerts yet.</span></div>'};
$("save").onclick=function(){IDS.forEach(function(k){var v=parseFloat($(k).value);if(!isNaN(v))cfg[k]=v});cfg.ip=$("ip").value.trim();persist();log("Settings saved",0)};
$("csv").onclick=function(){
  var t="time,motor_temp_C,current_A,gx,gy,gz,vibration,rpm_hall1,rpm_hall2,slip_percent\n"+rows.map(function(r){return r.join(",")}).join("\n");
  var a=document.createElement("a");a.href=URL.createObjectURL(new Blob([t],{type:"text/csv"}));a.download="conveyor-log.csv";a.click();
};
window.addEventListener("resize",drawAll);
})();
