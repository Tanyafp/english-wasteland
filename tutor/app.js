(() => {
"use strict";
const K="english-tutor-v1";
const $=id=>document.getElementById(id);
const LESSONS=window.TUTOR_LESSONS||[];
const DAY_MS=1800; // Weekdays 30 minutes, Friday 45 minutes.
const REQUIRED=["study","reading","understand","grammar","words","final","review"];
const PHASES={study:"1 · Карточки",reading:"2 · Чтение вслух",understand:"3 · Вопросы по тексту",grammar:"4 · Грамматика",words:"5 · Выбор перевода",final:"6 · Проверка слов",review:"7 · Закрепление",completed:"Урок завершён"};
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
state.dayOverrides=state.dayOverrides||{};
const CAL=window.ENGLISH_TUTOR_PLAN;
let selectedDate=today();
let lastAction=Date.now(),lastSave=0,parentUnlocked=false,recognition=null,lastCalendarToday=today();
function save(){localStorage.setItem(K,JSON.stringify(state));lastSave=Date.now()}
function planFor(date=selectedDate){return CAL.plan(date,state.dayOverrides)}
function lesson(){const p=planFor();return p.status==="lesson"?p.lesson:LESSONS[0]}
function minSeconds(){const p=planFor();return (p.status==="lesson"?p.minutes:30)*60}
function finalCount(){return planFor().isReview?8:5}
function repeatTarget(){return planFor().isReview?6:3}
function renderCalendar(){
 const panel=$("calendarBoard");if(!panel)return;
 const weeks=CAL.board(state.dayOverrides);
 panel.innerHTML=weeks.map(week=>'<div class="calendar-week"><strong>Неделя '+week.week+'</strong><div class="calendar-days">'+week.dates.map((day,i)=>{
  const labels=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"],isPast=day.date<=today();
  const stored=day.status==="lesson"?state.sessions[day.date+"|"+day.lesson.id]:null;
  const status=stored?.complete?"✓ Сдано":stored?.active?"◐ Начато":day.status==="rest"?"Выходной":day.isReview?"Большая проверка":"Новый урок";
  const label=day.status==="lesson"?day.lesson.title:day.status==="rest"?"Отдых":day.title;
  return '<button type="button" data-calendar="'+day.date+'" '+(!isPast||day.status!=="lesson"?"disabled":"")+' class="calendar-day '+(selectedDate===day.date?"selected ":"")+(stored?.complete?"complete ":"")+(day.status==="rest"?"rest":"")+'"><b>'+labels[i]+' · '+day.date.slice(8)+'</b><span>'+escapeHtml(label)+'</span><small>'+status+'</small></button>';
 }).join("")+'</div></div>').join("");
 panel.querySelectorAll("[data-calendar]").forEach(b=>b.onclick=()=>{if(recognition){try{recognition.abort()}catch{}recognition=null}selectedDate=b.dataset.calendar;lastAction=Date.now();render();if(parentUnlocked)renderParent()});
}
function words(){let base=lesson().words.slice(),extras=state.extraWordsByLesson[lesson().id]||[];for(const pair of extras){if(!base.some(p=>norm(p[0])===norm(pair[0])))base.push(pair)}return base}
function newSession(){return {date:selectedDate,lessonId:lesson().id,stage:"study",studyIndex:0,compIndex:0,gramIndex:0,wordCursor:0,finalIndex:0,reviewIndex:0,reviewCorrect:0,active:0,spoken:false,readCoverage:null,spokenMode:"",streak:{},cardSeen:{},cardOpen:{},wordDone:{},complete:false,completedAt:null}}
function session(){
 const key=selectedDate+"|"+lesson().id;
 if(!state.sessions[key]){state.sessions[key]=newSession();save()}
 const s=state.sessions[key];
  s.streak=s.streak||{};s.cardSeen=s.cardSeen||{};s.cardOpen=s.cardOpen||{};s.wordDone=s.wordDone||{};
 s.compDone=s.compDone||{};s.gramDone=s.gramDone||{};s.finalDone=s.finalDone||{};
 if(!s.taskMigrationDone){
  for(let i=0;i<(s.compIndex||0);i++)s.compDone[i]=true;
  for(let i=0;i<(s.gramIndex||0);i++)s.gramDone[i]=true;
  for(let i=0;i<(s.finalIndex||0);i++)s.finalDone[i]=true;
  s.compCursor=Math.min(s.compIndex||0,lesson().questions.length-1);
  s.gramCursor=Math.min(s.gramIndex||0,lesson().grammar.length-1);
  s.finalCursor=Math.min(s.finalIndex||0,Math.min(finalCount(),words().length)-1);
  s.taskMigrationDone=true;save();
 }
 // Keep progress earned in the previous linear version.
 if(!s.cardMigrationDone){if(s.studyIndex>=words().length)words().forEach(p=>s.cardSeen[p[0]]=true);s.cardMigrationDone=true;save()}
 if(!s.wordMigrationDone){words().forEach(p=>{if((s.streak[p[0]]||0)>=3)s.wordDone[p[0]]=true});s.wordMigrationDone=true;save()}
 return s;
}
function activeTime(n){return String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0")}
function mastered(){return words().filter(p=>!!session().wordDone[p[0]]).length}
function isDone(stage,s=session()){
 const w=words(),L=lesson();
 switch(stage){
  case "study":return w.every(p=>!!s.cardSeen[p[0]]);
  case "reading":return !!s.spoken;
  case "understand":return L.questions.every((q,i)=>!!s.compDone[i]);
  case "grammar":return L.grammar.every((q,i)=>!!s.gramDone[i]);
  case "words":return w.every(p=>!!s.wordDone[p[0]]);
  case "final":return w.slice(0,finalCount()).every((p,i)=>!!s.finalDone[i]);
  case "review":return (s.reviewCorrect||0)>=repeatTarget();
 }
 return false;
}
function completedSections(){return REQUIRED.filter(k=>isDone(k)).length}
function allSectionsDone(){return REQUIRED.every(k=>isDone(k))}
function nextPending(){return REQUIRED.find(k=>!isDone(k))||"review"}
function progress(){return Math.round(100*completedSections()/REQUIRED.length)}
function renderReference(){
 const L=lesson(),ref=$("lessonReference");if(!ref)return;
 ref.innerHTML='<div class="eyebrow">Опора для каждого задания</div><h3>📖 Текст всегда рядом</h3><div class="reading">'+escapeHtml(L.text)+'</div><details class="source-text"><summary>🗂 Словарик с переводами</summary><div class="refwords">'+words().map(p=>'<div class="refword"><b>'+escapeHtml(p[0])+'</b>'+escapeHtml(p[1])+'</div>').join("")+'</div></details><p class="small muted">Сначала можно смотреть сюда. Постепенно старайся отвечать самостоятельно.</p>';
}
function renderNav(){
 const el=$("sectionNav");if(!el)return;
 el.innerHTML=REQUIRED.map(k=>'<button type="button" data-section="'+k+'" class="'+(session().stage===k?"active ": "")+(isDone(k)?"done":"")+'" aria-current="'+(session().stage===k?"step":"false")+'">'+(isDone(k)?"✓ ":"○ ")+escapeHtml(PHASES[k].replace(/^\d+ · /,""))+'</button>').join("");
 el.querySelectorAll("[data-section]").forEach(b=>b.onclick=()=>changeStage(b.dataset.section));
}
function tryComplete(){
 const s=session();
 if(!s.complete&&allSectionsDone()&&s.active>=minSeconds()){
  s.stage="completed";s.complete=true;s.completedAt=new Date().toISOString();save();render();
 }
}
function sectionFinished(text){
 return '<div class="section-complete"><h3>✓ Этот раздел выполнен</h3><p>'+escapeHtml(text)+'</p><button id="goNextSection" class="primary">Перейти к следующему незавершённому разделу</button></div>';
}
function wireNextSection(){const b=$("goNextSection");if(b)b.onclick=()=>changeStage(nextPending())}
function note(t,isError=false){$("feedback").innerHTML='<div class="notice '+(isError?"error":"success")+'">'+escapeHtml(t)+'</div>'}
function record(type,prompt,answer,expected,ok){state.history.push({at:new Date().toISOString(),date:selectedDate,lessonId:lesson().id,type,prompt,answer:String(answer),expected:String(expected),ok});if(state.history.length>2500)state.history=state.history.slice(-2500);lastAction=Date.now();save()}
function advance(stage){let s=session();s.stage=stage;save();render()}
function updateStats(){
 let s=session();
 $("timer").textContent=activeTime(s.active)+" / "+activeTime(minSeconds());
 $("mastered").textContent=mastered()+" / "+words().length;
 $("progressBar").style.width=progress()+"%";
 const hint=$("completionHint");if(hint)hint.textContent="Выполнено "+completedSections()+" из "+REQUIRED.length+" разделов. Можно выбрать любой раздел. Для завершения нужны все задания и минимум "+Math.round(minSeconds()/60)+" активных минут.";
}
function changeStage(stage){if(!REQUIRED.includes(stage)&&stage!=="completed")return;try{if(recognition){recognition.abort();recognition=null}}catch{}session().stage=stage;save();render()}
function textInput(placeholder){return '<div class="control"><input id="answerInput" type="text" autocomplete="off" spellcheck="false" placeholder="'+escapeHtml(placeholder)+'"><button id="submitAnswer" class="primary">Проверить</button></div>'}
function inputWire(fn,voiceLang="en-US"){
 const input=$("answerInput"),submit=$("submitAnswer");
 submit?.addEventListener("click",()=>fn(input.value));
 input?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();fn(input.value)}});
 if(voiceLang&&submit&&input){
  const mic=document.createElement("button");
  mic.type="button";mic.textContent="🎤 Ответить голосом";
  submit.parentElement.appendChild(mic);
  const status=document.createElement("p");
  status.className="small muted voice-status";
  status.setAttribute("role","status");
  status.textContent="После голосового ввода проверь распознанный текст и нажми «Проверить».";
  submit.parentElement.insertAdjacentElement("afterend",status);
  mic.onclick=()=>{
   const Engine=window.SpeechRecognition||window.webkitSpeechRecognition;
   if(!Engine){status.textContent="Распознавание недоступно. Попробуй Chrome или ответь текстом.";return}
   try{
    if(recognition){try{recognition.abort()}catch{}recognition=null}
    const r=new Engine();recognition=r;
    r.lang=voiceLang;r.continuous=false;r.interimResults=false;r.maxAlternatives=3;
    mic.disabled=true;mic.textContent="🎤 Слушаю…";
    status.textContent="Говори. Ответ ещё не проверяется.";
    let heard=false,problem="";
    r.onresult=e=>{
     if(!e.results?.length)return;
     const transcript=e.results[0][0].transcript;
     if(!transcript)return;
     heard=true;input.value=transcript;lastAction=Date.now();
     status.textContent="Микрофон услышал: «"+transcript+"». Если неверно — исправь текст или повтори голосом. Только после этого нажми «Проверить».";
     input.focus();
    };
    r.onerror=e=>{
     const explanations={"not-allowed":"Доступ к микрофону запрещён. Разреши его для этого сайта в браузере.","service-not-allowed":"Распознавание недоступно.","network":"Нет связи с сервисом распознавания. Проверь интернет.","audio-capture":"Браузер не видит микрофон.","no-speech":"Речь не распознана."};
     problem=explanations[e.error]||"Ошибка: "+e.error;
     status.textContent=problem+" Ошибкой в уроке это не считается.";
    };
    r.onend=()=>{
     if(recognition===r)recognition=null;
     if(mic.isConnected){mic.disabled=false;mic.textContent="🎤 Ответить голосом"}
     if(!heard&&!problem&&status.isConnected)status.textContent="Ничего не распознано. Попробуй ещё раз без штрафа.";
    };
    r.start();
   }catch(e){recognition=null;mic.disabled=false;mic.textContent="🎤 Ответить голосом";status.textContent="Микрофон не запустился: "+e.message+". Попробуй ещё раз."}
  };
 }
 input?.focus();
}
function questionPicker(items,completed,current){
 return '<div class="task-picker"><p class="small muted">Все задания раздела — выбирай любое:</p><div class="task-grid">'+items.map((t,i)=>
  '<button type="button" data-task-index="'+i+'" class="'+(completed[i]?"done ":"")+(i===current?"selected":"")+'"><span>'+(completed[i]?"✓ ":"○ ")+(i+1)+'</span><span>'+escapeHtml(t)+'</span></button>'
 ).join("")+'</div></div>';
}
function wireQuestionPicker(field){
 $("taskArea").querySelectorAll("[data-task-index]").forEach(b=>b.onclick=()=>{
  session()[field]=Number(b.dataset.taskIndex);save();render();
 });
}
function nextQuestion(current,count,done){
 for(let z=1;z<=count;z++){const i=(current+z)%count;if(!done[i])return i}
 return current;
}
function wordPicker(w,done,current){
 return '<div class="task-picker"><p class="small muted">Можно выбрать любое слово:</p><div class="task-grid">'+w.map((p,i)=>
  '<button type="button" data-word-pick="'+i+'" '+(done[p[0]]?"disabled":"")+' class="'+(done[p[0]]?"done ":"")+(i===current?"selected":"")+'"><span>'+(done[p[0]]?"✓ ":"○ ")+'</span><span>'+escapeHtml(p[0])+'</span></button>'
 ).join("")+'</div></div>';
}
function wireWordPicker(){
 $("taskArea").querySelectorAll("[data-word-pick]").forEach(b=>b.onclick=()=>{
  session().wordCursor=Number(b.dataset.wordPick);save();render();
 });
}
function maskedExample(en){
 const sentences=lesson().text.match(/[^.!?]+[.!?]?/g)||[];
 const literal=en.replace(/[-\/\\^$*+?.()|[\]{}]/g,"\\$&");
 const re=new RegExp("\\b"+literal+"\\b","i");
 const sentence=sentences.find(s=>re.test(s));
 return sentence?'<div class="example"><span class="eyebrow">Контекст из текста урока</span><p>'+escapeHtml(sentence.trim().replace(re,"______"))+'</p></div>':
  '<p class="small muted">Слово из словаря урока. При необходимости открой текст ниже.</p>';
}
function sourceTextToggle(){
 return '<details class="source-text"><summary>📖 Открыть текст урока</summary><div class="reading">'+escapeHtml(lesson().text)+'</div></details>';
}
function nextWordIndex(){let w=words(),s=session();for(let z=0;z<w.length;z++){let i=((s.wordCursor||0)+z)%w.length;if(!s.wordDone[w[i][0]])return i}return -1}
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
    const activeRecognition=recognition;
    recognition.onend=()=>{
      if(recognition!==activeRecognition)return;
      recognition=null;
      if(s.stage!=="reading")return;
      if(buffer.trim()){const report=readingScore(buffer,L.text);s.spoken=true;s.spokenMode="recognized";s.readCoverage=report.percent;save();render();note("Микрофон распознал примерно "+report.percent+"% слов текста. Это приблизительный результат распознавания, не оценка произношения и не ошибка в уроке.")}
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
 renderCalendar();
 const selected=planFor();
 const el=$("taskArea");
 if(selected.status!=="lesson"){
  $("lessonLevel").textContent="Расписание";
  $("lessonTitle").textContent=selected.title;
  $("lessonInfo").textContent=selected.status==="rest"?"Отдыхай! Если остались незавершённые задания недели, вернись к ним в календаре.":"Четыре учебные недели закончились. Пройденные занятия сохранены, новые материалы появятся после обновления курса.";
  $("lessonPhase").textContent=selected.status==="rest"?"Выходной":"Курс";
  $("timer").textContent="—";$("mastered").textContent="—";
  $("dailyStatus").textContent=selected.status==="rest"?"Выходной":"Курс завершён";
  $("progressBar").style.width="0%";
  $("completionHint").textContent="";
  $("sectionNav").innerHTML="";$("lessonReference").innerHTML="";$("feedback").innerHTML="";
  el.innerHTML='<div class="section-complete"><h3>'+(selected.status==="rest"?"Сегодня отдыхаем!":"Сегодня нового урока нет")+'</h3><p>Результаты прошлых уроков сохраняются. Выбери учебный день в календаре, если хочешь закончить пропущенные задания.</p></div>';
  return;
 }
 const L=lesson(),s=session(),w=words();
 $("dailyStatus").textContent=selected.isReview?"Пятница · повторение":"Урок "+selected.week+"-й недели";
 $("lessonTitle").textContent=L.title;$("lessonLevel").textContent=L.level;
 $("lessonInfo").textContent=L.topic+" · "+w.length+" слов · минимум "+Math.round(minSeconds()/60)+" минут активной работы · "+selectedDate;
 $("lessonPhase").textContent=PHASES[s.stage]||"Урок";$("feedback").innerHTML="";
 updateStats();renderReference();renderNav();
 if(s.stage==="study"){
  const seen=w.filter(p=>s.cardSeen[p[0]]).length;
  el.innerHTML='<div class="eyebrow">Карточки для знакомства · '+seen+'/'+w.length+'</div><p>Никакой зубрёжки с первого раза. Нажимай на карточки — они перевернутся и покажут перевод. Все карточки можно просматривать сколько угодно раз.</p><div class="flash-grid">'+w.map(p=>{
   const open=!!s.cardOpen[p[0]],seen=!!s.cardSeen[p[0]];
   return '<button type="button" class="flashcard '+(open?"flipped":"")+'" data-flash="'+escapeHtml(p[0])+'" aria-label="Перевернуть карточку '+escapeHtml(p[0])+'"><span class="flash-main">'+escapeHtml(open?p[1]:p[0])+'</span><span class="flash-hint">'+(open?escapeHtml(p[0]):"Нажми, чтобы увидеть перевод")+'</span>'+(seen?'<span class="flash-check">✓ Просмотрено</span>':'')+'</button>';
  }).join("")+'</div><p class="small muted">Можешь начать с вопросов или чтения — карточки никуда не исчезнут.</p>'+(isDone("study")?sectionFinished("Все карточки просмотрены. Позже слова будут встречаться в тексте и заданиях."):"");
  el.querySelectorAll("[data-flash]").forEach(b=>b.onclick=()=>{const en=b.dataset.flash;s.cardOpen[en]=!s.cardOpen[en];if(s.cardOpen[en])s.cardSeen[en]=true;save();render()});
  wireNextSection();
 }else if(s.stage==="reading"){renderReading()}
 else if(s.stage==="understand"){
  const n=L.questions.length;
  const current=Math.min(s.compCursor||0,n-1),q=L.questions[current];
  const picker=questionPicker(L.questions.map(q=>q[0]),s.compDone,current);
  if(isDone("understand")){
   el.innerHTML=sectionFinished("Все вопросы по тексту решены. Можно повторить любой из них.")+picker;
   wireNextSection();wireQuestionPicker("compCursor");return;
  }
  el.innerHTML='<div class="eyebrow">Понимание текста · '+Object.values(s.compDone).filter(Boolean).length+'/'+n+' готово</div>'+picker+
   '<p>Ответь по-английски, опираясь на прочитанный текст.</p><p class="task">'+escapeHtml(q[0])+'</p>'+
   (s.compDone[current]?'<p class="notice success">✓ Этот вопрос уже решён. Выбери следующий незавершённый.</p>':
   q[2].map(ans=>'<button class="option" data-choice="'+escapeHtml(ans)+'">'+escapeHtml(ans)+'</button>').join(""));
  wireQuestionPicker("compCursor");
  el.querySelectorAll("[data-choice]").forEach(b=>b.onclick=()=>{
   const ok=equals(b.dataset.choice,q[1]);
   record("understand",q[0],b.dataset.choice,q[1],ok);
   if(ok){s.compDone[current]=true;s.compIndex=Object.values(s.compDone).filter(Boolean).length;s.compCursor=nextQuestion(current,n,s.compDone);save();render();note("Верно! Ты нашёл ответ в тексте.")}
   else note("Не совсем. Найди нужную часть текста справа и попробуй ещё раз.",true);
  });
 }else if(s.stage==="grammar"){
  const n=L.grammar.length;
  const current=Math.min(s.gramCursor||0,n-1),q=L.grammar[current];
  const picker=questionPicker(L.grammar.map(q=>q[0]),s.gramDone,current);
  if(isDone("grammar")){el.innerHTML=sectionFinished("Все задания по грамматике решены.")+picker;wireNextSection();wireQuestionPicker("gramCursor");return}
  el.innerHTML='<div class="eyebrow">Грамматика · '+Object.values(s.gramDone).filter(Boolean).length+'/'+n+' готово</div>'+picker+
   '<p class="muted">Тема: '+escapeHtml(L.topic)+'</p><p class="task">'+escapeHtml(q[0])+'</p>'+
   (s.gramDone[current]?'<p class="notice success">✓ Уже решено. Открой другое задание.</p>':textInput("Впиши пропущенное слово"));
  wireQuestionPicker("gramCursor");
  if(!s.gramDone[current])inputWire(answer=>{
   if(!answer.trim())return;
   const ok=equals(answer,q[2]);record("grammar",q[0],answer,q[1],ok);
   if(ok){s.gramDone[current]=true;s.gramIndex=Object.values(s.gramDone).filter(Boolean).length;s.gramCursor=nextQuestion(current,n,s.gramDone);save();render();note("Правильно!")}
   else note("Не совсем. Правильный вариант: "+q[1]+". Попробуй ввести его ещё раз.",true);
  });
 }else if(s.stage==="words"){
  let i=nextWordIndex();
  if(i<0){el.innerHTML=sectionFinished("Все слова выбраны правильно. Если ошибался, слово возвращалось до правильного ответа.")+wordPicker(w,s.wordDone,-1);wireNextSection();wireWordPicker();return}
  let [en,ru]=w[i];
  const possible=w.filter((p,j)=>j!==i).map(p=>p[1]);
  const rotated=possible.slice(i%possible.length).concat(possible.slice(0,i%possible.length));
  const options=rotated.slice(0,3);
  options.splice(i%4,0,ru);
  el.innerHTML='<div class="eyebrow">Выбери перевод · '+mastered()+'/'+w.length+' слов проверено</div>'+wordPicker(w,s.wordDone,i)+'<p>Сначала просто узнай значение. Не надо сразу писать слово по памяти — для этого позже будет отдельное упражнение.</p><div class="word">'+escapeHtml(en)+'</div>'+maskedExample(en)+options.map(v=>'<button type="button" class="option" data-word-option="'+escapeHtml(v)+'">'+escapeHtml(v)+'</button>').join("")+'<p class="small muted">Если ошибёшься, слово вернётся позже. Можешь подсмотреть в карточки или текст.</p>';
  wireWordPicker();
  el.querySelectorAll("[data-word-option]").forEach(b=>b.onclick=()=>{
   const given=b.dataset.wordOption,ok=equals(given,ru);
   record("words",en,given,ru,ok);
   if(ok){s.wordDone[en]=true;s.streak[en]=Math.max(s.streak[en]||0,1)}
   s.wordCursor=(i+1)%w.length;save();render();
   note(ok?"Верно! Ты узнал значение слова.":"Пока нет. Правильно: "+ru+". Посмотри текст и карточки — это слово ещё вернётся.",!ok);
  });
 }else if(s.stage==="final"){
  const subset=w.slice(0,Math.min(finalCount(),w.length)),n=subset.length;
  const current=Math.min(s.finalCursor||0,n-1),p=subset[current];
  const picker=questionPicker(subset.map(p=>p[1]),s.finalDone,current);
  if(isDone("final")){el.innerHTML=sectionFinished("Письменная проверка завершена. Все ошибки можно найти в истории ответов.")+picker;wireNextSection();wireQuestionPicker("finalCursor");return}
  el.innerHTML='<div class="eyebrow">Проверка слов · '+Object.values(s.finalDone).filter(Boolean).length+'/'+n+' готово</div>'+picker+
   '<p class="muted">Вспомни английское слово по значению и контексту. Текст остаётся справа.</p><div class="word">'+escapeHtml(p[1])+'</div>'+
   (s.finalDone[current]?'<p class="notice success">✓ Это слово уже написано правильно.</p>':
    maskedExample(p[0])+textInput("Английское слово"));
  wireQuestionPicker("finalCursor");
  if(!s.finalDone[current])inputWire(ans=>{
   if(!ans.trim())return;
   const ok=equals(ans,p[0]);record("final",p[0],ans,p[0],ok);
   if(ok){s.finalDone[current]=true;s.finalIndex=Object.values(s.finalDone).filter(Boolean).length;s.finalCursor=nextQuestion(current,n,s.finalDone);save();render();note("Правильно!")}
   else note("Не совсем. Посмотри предложение из текста и попробуй ещё раз.",true);
  });
 }else if(s.stage==="review"){
  if(s.reviewCorrect>=repeatTarget()){el.innerHTML=sectionFinished("Закрепление выполнено. Если время ещё не закончилось, можно повторить карточки или прочитать текст.");wireNextSection();return}
  let p=w[s.reviewIndex%w.length];
  el.innerHTML='<div class="eyebrow">Закрепление до 30 минут</div><p class="muted">Основные задания выполнены. Осталось активного времени: '+activeTime(Math.max(0,minSeconds()-s.active))+'.</p><div class="word">'+escapeHtml(p[1])+'</div>'+maskedExample(p[0])+textInput("Напиши по-английски")+sourceTextToggle()+'<p class="small muted">Нужно выполнить "+repeatTarget()+" правильных проверок.</p>';
  inputWire(ans=>{
    if(!ans.trim())return;
    let ok=equals(ans,p[0]);record("review",p[0],ans,p[0],ok);
    if(ok){s.reviewCorrect++;s.reviewIndex++;save();if(s.active>=minSeconds()&&s.reviewCorrect>=repeatTarget()&&allSectionsDone()){complete();return}render();note("Верно. Продолжаем повторение.")}else{ s.reviewIndex++;save();render();note("Правильно: "+p[0]+". Мы вернёмся к нему ещё.",true)}
  });
 }else if(s.stage==="completed"){
  el.innerHTML='<div class="eyebrow">На сегодня достаточно</div><h2>Урок сдан ✓</h2><p class="task">Ты занимался '+activeTime(s.active)+' и выполнил обязательные задания.</p><p>Выучено слов: <strong>'+mastered()+' из '+w.length+'</strong>. Завтра будут новые задания или повторение трудных слов.</p><p id="unlockMessage" class="notice">Проверка разрешения Steam…</p>';

 }
}
function complete(){
 let s=session();s.stage="completed";s.complete=true;s.completedAt=new Date().toISOString();save();render();unlockSteam();
}
function tick(){
 const current=today();
 if(current!==lastCalendarToday){
  if(selectedDate===lastCalendarToday)selectedDate=current;
  lastCalendarToday=current;lastAction=Date.now();render();
 }
 if(planFor().status!=="lesson")return;
 if(document.visibilityState==="visible"&&document.hasFocus()&&!$("studentView").classList.contains("hidden")&&Date.now()-lastAction<90000){
  const activeSession=session();
  if(!activeSession.complete){activeSession.active+=1;if(Date.now()-lastSave>9000)save()}
 }
 updateStats();tryComplete();
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
 $("lessonSelect").innerHTML=LESSONS.map(l=>'<option value="'+l.id+'" '+(lesson().id===l.id?"selected":"")+'>'+escapeHtml(l.title)+" · "+escapeHtml(l.level)+"</option>").join("");
 $("extraWords").value=(state.extraWordsByLesson[lesson().id]||[]).map(p=>p[0]+" = "+p[1]).join("\n");
 if(planFor().status!=="lesson")$("parentWords").textContent="Выбери учебный день в расписании. Суббота и воскресенье свободны.";
 else $("parentWords").innerHTML='<div class="table-scroll"><table><thead><tr><th>Слово</th><th>Перевод выбран</th><th>Ошибок</th></tr></thead><tbody>'+words().map(w=>'<tr><td>'+escapeHtml(w[0])+'</td><td>'+(session().wordDone[w[0]]?'✓':'—')+'</td><td>'+state.history.filter(a=>a.type==="words"&&a.lessonId===lesson().id&&a.prompt===w[0]&&!a.ok).length+'</td></tr>').join("")+'</tbody></table></div>';
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
setInterval(tick,1000);render();
})();