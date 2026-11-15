(() => {
"use strict";
const K="english-tutor-v1";
const $=id=>document.getElementById(id);
const LESSONS=window.TUTOR_LESSONS||[];
const DAY_MS=1800;
const PHASES={study:"1 · Новые слова",reading:"2 · Чтение вслух",understand:"3 · Понимание текста",grammar:"4 · Грамматика",words:"5 · Слова по памяти",final:"6 · Контрольная",review:"7 · Закрепление",completed:"Урок завершён"};
const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=v=>String(v??"").toLocaleLowerCase().replace(/[^\p{L}\p{N}\s']/gu," ").replace(/\s+/g," ").trim().replace(/ё/g,"е");
const equals=(value,accepted)=>[].concat(accepted).some(x=>norm(x)===norm(value));
function today(){let d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")}
let state;
try{state=JSON.parse(localStorage.getItem(K)||"{}")}catch{state={}}
if(!state||typeof state!=="object")state={};
state.assigned=state.assigned||LESSONS[0]?.id;
state.sessions=state.sessions||{};
state.history=state.history||[];
state.extraWordsByLesson=state.extraWordsByLesson||{};
let lastAction=Date.now(),lastSave=0,guardConnected=false,parentUnlocked=false,recognition=null;
function save(){localStorage.setItem(K,JSON.stringify(state));lastSave=Date.now()}
function lesson(){return LESSONS.find(x=>x.id===state.assigned)||LESSONS[0]}
function words(){let base=lesson().words.slice(),extras=state.extraWordsByLesson[lesson().id]||[];for(const pair of extras){if(!base.some(p=>norm(p[0])===norm(pair[0])))base.push(pair)}return base}
function newSession(){return {date:today(),lessonId:lesson().id,stage:"study",studyIndex:0,compIndex:0,gramIndex:0,wordCursor:0,finalIndex:0,reviewIndex:0,reviewCorrect:0,active:0,spoken:false,readCoverage:null,spokenMode:"",streak:{},complete:false,completedAt:null}}
function session(){let key=today()+"|"+lesson().id;if(!state.sessions[key]){state.sessions[key]=newSession();save()}return state.sessions[key]}
function activeTime(n){return String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0")}
function mastered(){return words().filter(p=>(session().streak[p[0]]||0)>=3).length}
function progress(){let s=session();return ({study:5,reading:17,understand:30,grammar:50,words:70,final:85,review:95,completed:100}[s.stage]||0)}
function note(t,isError=false){$("feedback").innerHTML='<div class="notice '+(isError?"error":"success")+'">'+escapeHtml(t)+'</div>'}
function record(type,prompt,answer,expected,ok){state.history.push({at:new Date().toISOString(),date:today(),lessonId:lesson().id,type,prompt,answer:String(answer),expected:String(expected),ok});if(state.history.length>2500)state.history=state.history.slice(-2500);lastAction=Date.now();save()}
function advance(stage){let s=session();s.stage=stage;save();render()}
function updateStats(){
 let s=session();
 $("timer").textContent=activeTime(s.active)+" / 30:00";
 $("mastered").textContent=mastered()+" / "+words().length;
 $("progressBar").style.width=progress()+"%";
}
function changeStage(stage){session().stage=stage;save();render()}
function textInput(placeholder){return '<div class="control"><input id="answerInput" type="text" autocomplete="off" spellcheck="false" placeholder="'+escapeHtml(placeholder)+'"><button id="submitAnswer" class="primary">Проверить</button></div>'}
function inputWire(fn){$("submitAnswer")?.addEventListener("click",()=>fn($("answerInput").value));$("answerInput")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();fn(e.target.value)}});$("answerInput")?.focus()}
function nextWordIndex(){let w=words(),s=session();for(let z=0;z<w.length;z++){let i=(s.wordCursor+z)%w.length;if((s.streak[w[i][0]]||0)<3)return i}return -1}
function readingScore(transcript,text){
 let original=norm(text).split(" ").filter(Boolean),spoken=norm(transcript).split(" ").filter(Boolean);
 // A subsequence match preserves order; it measures recognized coverage, not phoneme quality.
 let k=0,hits=[];
 for(let i=0;i<original.length;i++){let j=spoken.indexOf(original[i],k);if(j>=0){hits.push(i);k=j+1}}
 return {percent:original.length?Math.round(hits.length/original.length*100):0,hits};
}
function renderReading(){
 let s=session(),L=lesson();
 $("taskArea").innerHTML='<div class="eyebrow">Чтение и произношение</div><p>Прочитай английский текст вслух. Затем ответь на вопросы по смыслу.</p><div class="reading" id="readingText">'+escapeHtml(L.text)+'</div><div class="control"><button id="listenButton" class="primary">🎤 Начать чтение</button><button id="stopButton" disabled>Остановить запись</button><button id="manualRead">Я прочитал вслух (если микрофон не работает)</button></div><p class="small muted" id="readHelp">Распознавание речи зависит от браузера и интернета. Оно не проверяет каждый звук.</p><div id="readReport"></div><button id="continueRead" class="primary" '+(s.spoken?"":"disabled")+'>Перейти к вопросам</button>';
 $("continueRead").onclick=()=>changeStage("understand");
 $("manualRead").onclick=()=>{s.spoken=true;s.spokenMode="manual";save();render();note("Чтение отмечено вручную; точность произношения не оценивалась.")};
 $("listenButton").onclick=()=>{
   const Engine=window.SpeechRecognition||window.webkitSpeechRecognition;
   if(!Engine){$("readHelp").textContent="В этом браузере нет распознавания речи. Используй Chrome или ручную отметку.";return}
   let buffer="";
   try{
    recognition=new Engine();recognition.lang="en-US";recognition.continuous=true;recognition.interimResults=false;recognition.maxAlternatives=1;
    $("listenButton").disabled=true;$("stopButton").disabled=false;
    $("readHelp").textContent="Читай вслух в обычном темпе. Нажми «Остановить запись», когда закончишь.";
    recognition.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)buffer+=" "+e.results[i][0].transcript}lastAction=Date.now()};
    recognition.onerror=e=>{$("readHelp").textContent="Микрофон: "+e.error+". Можно попробовать ещё раз."};
    recognition.onend=()=>{
      recognition=null;
      if(buffer.trim()){const report=readingScore(buffer,L.text);s.spoken=true;s.spokenMode="recognized";s.readCoverage=report.percent;record("reading",L.title,buffer,"Текст урока",report.percent>=75);save();render();note("Распознано примерно "+report.percent+"% слов текста. Это не оценка фонетики.")}
      else {render();note("Речь не распознана. Попробуй снова или воспользуйся ручной отметкой.",true)}
    };
    recognition.start();
    $("stopButton").onclick=()=>{if(recognition)recognition.stop()};
   }catch(e){$("readHelp").textContent="Не удалось запустить микрофон: "+e.message}
 };
 if(s.spoken){$("readReport").innerHTML='<div class="notice">Чтение выполнено'+(s.readCoverage==null?" (ручная отметка)":": распознано около "+s.readCoverage+"% слов")+'.</div>'}
}
function render(){
 if(!LESSONS.length){$("taskArea").textContent="Нет данных уроков.";return}
 let L=lesson(),s=session(),w=words(),el=$("taskArea");
 $("lessonTitle").textContent=L.title;$("lessonLevel").textContent=L.level;
 $("lessonInfo").textContent=L.topic+" · "+w.length+" слов · минимум 30 минут активной работы";
 $("lessonPhase").textContent=PHASES[s.stage]||"Урок";$("feedback").innerHTML="";
 updateStats();
 if(s.stage==="study"){
  if(s.studyIndex>=w.length){changeStage("reading");return}
  let pair=w[s.studyIndex];
  el.innerHTML='<div class="eyebrow">Знакомство со словами · '+(s.studyIndex+1)+'/'+w.length+'</div><p class="muted">Прочитай слово вслух, вспомни значение и произнеси пример.</p><div class="word">'+escapeHtml(pair[0])+'</div><p class="task">'+escapeHtml(pair[1])+'</p><div class="control"><button id="pronounce">🔊 Послушать</button><button id="nextStudy" class="primary">Запомнил, дальше</button></div><p class="small muted">Позже программа попросит написать и перевести это слово без подсказок.</p>';
  $("pronounce").onclick=()=>{if(!("speechSynthesis" in window))return note("Синтез речи недоступен.",true);speechSynthesis.cancel();let utter=new SpeechSynthesisUtterance(pair[0]);utter.lang="en-US";utter.rate=.78;speechSynthesis.speak(utter)};
  $("nextStudy").onclick=()=>{s.studyIndex++;save();render()};
 }else if(s.stage==="reading"){renderReading()}
 else if(s.stage==="understand"){
  if(s.compIndex>=L.questions.length){changeStage("grammar");return}
  let q=L.questions[s.compIndex];
  el.innerHTML='<div class="eyebrow">Понимание текста · '+(s.compIndex+1)+'/'+L.questions.length+'</div><p>Ответь по-английски, опираясь на прочитанный текст.</p><p class="task">'+escapeHtml(q[0])+'</p>'+q[2].map(ans=>'<button class="option" data-choice="'+escapeHtml(ans)+'">'+escapeHtml(ans)+'</button>').join('')+'<details><summary>Посмотреть текст ещё раз</summary><p>'+escapeHtml(L.text)+'</p></details>';
  el.querySelectorAll("[data-choice]").forEach(b=>b.onclick=()=>{let ok=equals(b.dataset.choice,q[1]);record("understand",q[0],b.dataset.choice,q[1],ok);if(ok){s.compIndex++;save();render();note("Верно! Ты нашёл ответ в тексте.")}else note("Не совсем. Найди нужную часть текста и попробуй ещё раз.",true)});
 }else if(s.stage==="grammar"){
  if(s.gramIndex>=L.grammar.length){changeStage("words");return}
  let q=L.grammar[s.gramIndex];
  el.innerHTML='<div class="eyebrow">Грамматика · '+(s.gramIndex+1)+'/'+L.grammar.length+'</div><p class="muted">Тема: '+escapeHtml(L.topic)+'</p><p class="task">'+escapeHtml(q[0])+'</p>'+textInput("Впиши пропущенное слово");
  inputWire(answer=>{if(!answer.trim())return;let ok=equals(answer,q[2]);record("grammar",q[0],answer,q[1],ok);if(ok){s.gramIndex++;save();render();note("Правильно.")}else note("Повтори правило. Правильный вариант: "+q[1]+". Теперь введи его самостоятельно.",true)});
 }else if(s.stage==="words"){
  let i=nextWordIndex();
  if(i<0){changeStage("final");return}
  let [en,ru]=w[i],level=s.streak[en]||0,mode=level%3;
  let prompt=mode===0?en:ru;
  let label=mode===0?"Переведи на русский":mode===1?"Напиши английское слово по памяти":"Проверка написания: снова напиши по-английски";
  el.innerHTML='<div class="eyebrow">Тренировка памяти · '+mastered()+'/'+w.length+' слов полностью закреплено</div><p>'+label+'</p><div class="word">'+escapeHtml(prompt)+'</div>'+textInput(mode===0?"Перевод на русском":"Английский без подсказки")+'<p class="small muted">Для освоения нужно три правильных ответа подряд. При ошибке серия этого слова начинается сначала.</p>';
  inputWire(answer=>{
   if(!answer.trim())return;
   let expected=mode===0?ru:en,ok=equals(answer,expected);
   record("words",en,answer,expected,ok);
   s.streak[en]=ok?level+1:0;
   s.wordCursor=(i+1)%w.length;save();render();
   note(ok?"Верно! Серия: "+s.streak[en]+" из 3.":"Пока неверно. Правильно: "+expected+". Слово вернётся позже.",!ok);
  });
 }else if(s.stage==="final"){
  let subset=w.slice(0,Math.min(5,w.length));
  if(s.finalIndex>=subset.length){changeStage("review");return}
  let p=subset[s.finalIndex];
  el.innerHTML='<div class="eyebrow">Итоговая проверка · '+(s.finalIndex+1)+'/'+subset.length+'</div><p class="muted">Подсказок не будет. Напиши перевод с русского на английский.</p><div class="word">'+escapeHtml(p[1])+'</div>'+textInput("Английский перевод");
  inputWire(ans=>{
   if(!ans.trim())return;
   let ok=equals(ans,p[0]);record("final",p[0],ans,p[0],ok);
   if(ok){s.finalIndex++;save();render();note("Правильно!")}else note("Неверно. Вернись к слову и попробуй ещё раз.",true);
  });
 }else if(s.stage==="review"){
  let p=w[s.reviewIndex%w.length];
  el.innerHTML='<div class="eyebrow">Закрепление до 30 минут</div><p class="muted">Основные задания выполнены. Чтобы закрепить материал, повтори слова по памяти. Осталось активного времени: '+activeTime(Math.max(0,DAY_MS-s.active))+'.</p><div class="word">'+escapeHtml(p[1])+'</div>'+textInput("Напиши по-английски")+'<p class="small muted">Нужно выполнить не менее трёх правильных проверок на этом этапе.</p>';
  inputWire(ans=>{
    if(!ans.trim())return;
    let ok=equals(ans,p[0]);record("review",p[0],ans,p[0],ok);
    if(ok){s.reviewCorrect++;s.reviewIndex++;save();if(s.active>=DAY_MS&&s.reviewCorrect>=3){complete();return}render();note("Верно. Продолжаем повторение.")}else{ s.reviewIndex++;save();render();note("Правильно: "+p[0]+". Мы вернёмся к нему ещё.",true)}
  });
 }else if(s.stage==="completed"){
  el.innerHTML='<div class="eyebrow">На сегодня достаточно</div><h2>Урок сдан ✓</h2><p class="task">Ты занимался '+activeTime(s.active)+' и выполнил обязательные задания.</p><p>Выучено слов: <strong>'+mastered()+' из '+w.length+'</strong>. Завтра будут новые задания или повторение трудных слов.</p><p id="unlockMessage" class="notice">Проверка разрешения Steam…</p>';
  syncGuard();
 }
}
function complete(){
 let s=session();s.stage="completed";s.complete=true;s.completedAt=new Date().toISOString();save();render();unlockSteam();
}
async function checkGuard(){
 try{const res=await fetch("/api/guard",{cache:"no-store"});if(!res.ok||!(res.headers.get("content-type")||"").includes("application/json"))throw Error("not running");const g=await res.json();guardConnected=true;$("steamStatus").textContent=g.unlocked?"Открыт":"Закрыт"}catch{guardConnected=false;$("steamStatus").textContent="Не подключён"}
}
async function unlockSteam(){
 if(!guardConnected){if($("unlockMessage"))$("unlockMessage").textContent="Урок завершён. Windows-защитник Steam не запущен — разблокировка не передана.";return}
 try{const r=await fetch("/api/unlock",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date:today(),minutes:Math.floor(session().active/60),completed:session().complete})});if(!r.ok)throw Error("отказ сервера");const result=await r.json();if($("unlockMessage"))$("unlockMessage").textContent=result.unlocked?"Steam разрешён до конца сегодняшнего дня.":"Защитник не разрешил Steam.";await checkGuard()}catch(e){if($("unlockMessage"))$("unlockMessage").textContent="Не удалось открыть Steam: "+e.message}
}
function syncGuard(){checkGuard()}
function tick(){
 if(document.visibilityState==="visible"&&document.hasFocus()&&(Date.now()-lastAction)<90000){
  let s=session();if(!s.complete){s.active+=1;if(Date.now()-lastSave>9000)save()}
 }
 updateStats();
}
for(const evt of ["pointerdown","keydown","scroll"]){document.addEventListener(evt,()=>{lastAction=Date.now()},{passive:true})}
document.addEventListener("visibilitychange",()=>{lastAction=Date.now();save()});
window.addEventListener("beforeunload",save);
function view(parent){
 $("studentView").classList.toggle("hidden",parent);$("parentView").classList.toggle("hidden",!parent);if(parent)renderParent();else render();
}
$("studentNav").onclick=()=>view(false);
$("parentNav").onclick=()=>view(true);
async function hashPin(pin,salt){let data=new TextEncoder().encode(salt+":"+pin);let bytes=await crypto.subtle.digest("SHA-256",data);return Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,"0")).join("")}
function renderParent(){
 const exists=!!state.parentPin;
 $("parentAuth").classList.toggle("hidden",parentUnlocked);
 $("parentDashboard").classList.toggle("hidden",!parentUnlocked);
 $("pinHelp").textContent=exists?"Введи свой PIN, чтобы посмотреть результаты и выдать задания.":"Первый вход: придумай PIN от 4 символов, чтобы ребёнок не открывал настройки случайно.";
 $("pinButton").textContent=exists?"Войти":"Установить PIN";
 if(!parentUnlocked)return;
 const sessions=Object.values(state.sessions),done=sessions.filter(x=>x.complete),total=Math.round(sessions.reduce((n,s)=>n+(s.active||0),0)/60);
 $("parentDays").textContent=done.length;$("parentMinutes").textContent=total;$("parentErrors").textContent=state.history.filter(a=>!a.ok).length;
 $("lessonSelect").innerHTML=LESSONS.map(l=>'<option value="'+l.id+'" '+(state.assigned===l.id?"selected":"")+'>'+escapeHtml(l.title)+" · "+escapeHtml(l.level)+"</option>").join("");
 $("extraWords").value=(state.extraWordsByLesson[state.assigned]||[]).map(p=>p[0]+" = "+p[1]).join("\n");
 $("parentWords").innerHTML='<div class="table-scroll"><table><thead><tr><th>Слово</th><th>Верных подряд</th><th>Ошибок</th></tr></thead><tbody>'+words().map(w=>'<tr><td>'+escapeHtml(w[0])+'</td><td>'+(session().streak[w[0]]||0)+'/3</td><td>'+state.history.filter(a=>a.type==="words"&&a.lessonId===lesson().id&&a.prompt===w[0]&&!a.ok).length+'</td></tr>').join("")+'</tbody></table></div>';
 $("attemptRows").innerHTML=state.history.slice(-90).reverse().map(a=>'<tr><td>'+escapeHtml(new Date(a.at).toLocaleString("ru-RU"))+'</td><td>'+escapeHtml(a.type)+'</td><td>'+escapeHtml(a.prompt).slice(0,110)+'</td><td>'+escapeHtml(a.answer).slice(0,100)+'</td><td style="color:'+(a.ok?"#1d7654":"#b33d41")+'">'+(a.ok?"Верно":"Ошибка")+'</td></tr>').join("")||'<tr><td colspan="5">Пока нет ответов</td></tr>';
}
$("pinButton").onclick=async()=>{
 let pin=$("pinInput").value;if(pin.length<4){$("pinMessage").textContent="Нужно минимум 4 символа.";return}
 if(!state.parentPin){let salt=Array.from(crypto.getRandomValues(new Uint8Array(10))).map(n=>n.toString(16).padStart(2,"0")).join("");state.parentPin={salt,hash:await hashPin(pin,salt)};save();parentUnlocked=true;$("pinInput").value="";renderParent()}
 else{let h=await hashPin(pin,state.parentPin.salt);if(h===state.parentPin.hash){parentUnlocked=true;$("pinInput").value="";$("pinMessage").textContent="";renderParent()}else $("pinMessage").textContent="Неверный PIN"}
};
$("lessonSelect").onchange=()=>{$("extraWords").value=(state.extraWordsByLesson[$("lessonSelect").value]||[]).map(p=>p[0]+" = "+p[1]).join("\n")};
$("assignLesson").onclick=()=>{
 let id=$("lessonSelect").value,lines=$("extraWords").value.split("\n").map(v=>v.trim()).filter(Boolean);
 const pairs=[];for(const line of lines){let i=line.indexOf("=");if(i<1||!line.slice(i+1).trim()){$("assignMessage").textContent="Неверная строка: "+line+". Формат: word = перевод";return}pairs.push([line.slice(0,i).trim().toLowerCase(),line.slice(i+1).trim()])}
 if(pairs.length>12){$("assignMessage").textContent="Можно назначить до 12 дополнительных слов.";return}
 state.extraWordsByLesson[id]=pairs;state.assigned=id;save();$("assignMessage").textContent="Назначено: "+LESSONS.find(l=>l.id===id).title+". Урок доступен в разделе «Урок».";renderParent();
};
$("exportData").onclick=()=>{let blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),sessions:state.sessions,history:state.history,assigned:state.assigned},null,2)],{type:"application/json"});let a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="english-tutor-report-"+today()+".json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000)};
$("lockParent").onclick=()=>{parentUnlocked=false;view(false)};
setInterval(tick,1000);render();checkGuard();
})();