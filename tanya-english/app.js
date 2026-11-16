(() => {
"use strict";
const LESSONS = window.TANYA_LESSONS || [];
const STORAGE_KEY = "my-english-week-tanya-v1";
const SECTION_INFO = [
 ["story","Диалог"],["cards","Новые слова"],["listen","На слух"],["understand","Понимание"],
 ["build","Собери фразу"],["write","Напиши"],["speak","Говори"],["recall","Память"]
];
const LABELS = Object.fromEntries(SECTION_INFO);
const $ = id => document.getElementById(id);
const e = v => String(v == null ? "" : v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&#39;","'":"&#39;"}[c]));
const normalize = value => String(value || "").toLocaleLowerCase("en").replace(/[’‘]/g,"'").replace(/[^a-z0-9'\s]/g," ").replace(/\s+/g," ").trim().replace(/\bi'm\b/g,"i am").replace(/\bi'd\b/g,"i would");
const fmt = sec => { sec = Math.max(0,Math.floor(Number(sec)||0));return String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0"); };
const minutes = L => L.review ? 45 : 30;
const count = x => Object.keys(x||{}).filter(k=>x[k]).length;
let raw = {};
try { raw=JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch (_) {}
let state = raw && typeof raw==="object" ? raw : {};
state.days = state.days && typeof state.days==="object" ? state.days : {};
state.vocab = state.vocab && typeof state.vocab==="object" ? state.vocab : {};
state.settings = state.settings && typeof state.settings==="object" ? state.settings : {};
state.version = 1;
const localToday=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
const dateLesson=LESSONS.find(l=>l.date===localToday());
let selectedId = LESSONS.some(l=>l.id===state.selected) ? state.selected : (dateLesson ? dateLesson.id : LESSONS[0].id);
let currentSection = state.days[selectedId]?.section || "story";
let ui = { index:{}, flipped:false, picked:[], wrong:null, message:"", messageKind:"", speechMessage:"" };
let playing = false, recognizer = null, lastAction = Date.now(), lastTick = Date.now();
function active(){lastAction=Date.now();}
function save(){state.selected=selectedId;try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(err){console.warn("Progress not saved",err);}}
function L(){return LESSONS.find(l=>l.id===selectedId)||LESSONS[0];}
function s(){
 const id=selectedId;
 if(!state.days[id] || typeof state.days[id]!=="object")state.days[id]={};
 const d=state.days[id];
 for(const key of ["story","cards","listen","understand","build","write","speak","recall"])if(!d[key]||typeof d[key]!=="object")d[key]={};
 if(!Array.isArray(d.attempts))d.attempts=[];
 d.seconds=Math.max(0,Number(d.seconds)||0);
 if(!d.section)d.section="story";
 return d;
}
function optionShuffle(arr,seed){
 let v=arr.slice(),x=seed*1103515245+12345;
 for(let i=v.length-1;i>0;i--){x=(Math.imul(x,1664525)+1013904223)|0;const j=(x>>>0)%(i+1);[v[i],v[j]]=[v[j],v[i]];}
 return v;
}
function wordRecord(word,ok){
 if(!word)return;
 if(!state.vocab[word])state.vocab[word]={seen:0,correct:0,wrong:0};
 state.vocab[word].seen++;
 if(ok)state.vocab[word].correct++;else state.vocab[word].wrong++;
 state.vocab[word].last=L().date;
}
function record(kind,index,answer,correct,word){
 const d=s();
 d.attempts.push({date:L().date,at:new Date().toISOString(),section:kind,index,answer:String(answer||""),correct:!!correct,word:word||""});
 if(d.attempts.length>3000)d.attempts=d.attempts.slice(-3000);
 if(word)wordRecord(word,correct);
 save();
}
function completeSection(k){const d=s(),l=L();return k==="story"?count(d.story)>=l.story.length:k==="cards"?count(d.cards)>=l.words.length:k==="listen"?count(d.listen)>=l.listen.length:k==="understand"?count(d.understand)>=l.questions.length:k==="build"?count(d.build)>=l.build.length:k==="write"?count(d.write)>=l.write.length:k==="speak"?count(d.speak)>=l.speak.length:k==="recall"?count(d.recall)>=l.words.length:false;}
function finishedSections(){return SECTION_INFO.filter(v=>completeSection(v[0])).length;}
function maybeFinish(){
 const d=s();
 if(!d.finished && SECTION_INFO.every(v=>completeSection(v[0])) && d.seconds>=minutes(L())*60){
   d.finished=new Date().toISOString(); save(); return true;
 }
 return false;
}
function resetUI(){ui.index={};ui.flipped=false;ui.picked=[];ui.wrong=null;ui.message="";ui.messageKind="";ui.speechMessage="";}
function switchDay(id){
 if(!LESSONS.some(v=>v.id===id))return;
 stopRecognition();if(window.speechSynthesis)window.speechSynthesis.cancel();playing=false;
 selectedId=id; currentSection=s().section || "story";resetUI();active();save();render();
}
function switchSection(k){
 if(!LABELS[k])return;
 stopRecognition();if(window.speechSynthesis)window.speechSynthesis.cancel();playing=false;
 currentSection=k;s().section=k; resetUI();active();save();render();
}
function setMessage(txt,kind="ok"){ui.message=txt;ui.messageKind=kind;renderMessage();}
function renderMessage(){const out=$("feedback");out.textContent=ui.message||"";out.className="feedback "+(ui.messageKind||"");}
function renderDayStrip(){
 $("dayStrip").innerHTML=LESSONS.map((l,i)=>{const d=state.days[l.id],total=d?.seconds||0,done=!!d?.finished;
 return '<button type="button" class="day-btn '+(l.id===selectedId?"active ":"")+(done?"done":"")+'" data-day="'+l.id+'"><span class="day-number">'+["ПН","ВТ","СР","ЧТ","ПТ"][i]+' · '+l.date.slice(8)+'</span><strong>'+e(l.title)+'</strong><small>'+(done?"Пройдено ✓":total>0?"Начато · "+Math.floor(total/60)+" мин":l.review?"Большая проверка":"30 минут")+'</small>'+(done?'<span class="day-bubble">✓</span>':"")+'</button>';
 }).join("");
}
function renderStats(){
 const d=s(),l=L(),done=finishedSections(),seconds=d.seconds;
 $("clock").innerHTML=fmt(seconds)+' <i>/ '+fmt(minutes(l)*60)+'</i>';
 $("sectionMetric").innerHTML=done+' <i>/ '+SECTION_INFO.length+'</i>';
 $("wordMetric").innerHTML=count(d.cards)+' <i>/ '+l.words.length+'</i>';
 $("timeBar").style.width=Math.min(100,seconds/(minutes(l)*60)*100)+"%";
 $("sectionBar").style.width=100*done/SECTION_INFO.length+"%";
 $("wordBar").style.width=100*count(d.cards)/l.words.length+"%";
 $("lessonState").textContent=d.finished?"✓ Неделя в копилке":done===SECTION_INFO.length?"Все блоки пройдены":done?"В процессе":"Можно начинать";
 $("lessonState").className="pill"+(d.finished?" success":"");
}
function renderReference(){
 const l=L();
 $("dayLabel").textContent=l.day.toUpperCase()+" · "+l.date.slice(8)+" НОЯБРЯ";
 $("lessonTitle").textContent=l.title;
 $("lessonDescription").textContent=l.topic;
 $("referenceStory").innerHTML=l.story.map((p,i)=>'<button type="button" class="story-line" data-action="refSpeak" data-i="'+i+'"><span class="sound-icon">◖)))</span><span class="en">'+e(p[0])+'</span><span class="ru">'+e(p[1])+'</span></button>').join("");
 $("glossaryCount").textContent="("+l.words.length+")";
 $("referenceWords").className="reference-words";
 $("referenceWords").innerHTML=l.words.map((w,i)=>'<button type="button" class="vocab-row" data-action="speakWordRef" data-i="'+i+'" title="Произнести слово"><b>🔊 '+e(w[0])+'</b><span>'+e(w[1])+'</span></button>').join("");
 $("referenceGrammar").textContent=l.grammar;
}
function renderNav(){
 $("sectionsNav").innerHTML=SECTION_INFO.map(([key,label],i)=>'<button type="button" data-section="'+key+'" class="section-btn '+(key===currentSection?"active ":"")+(completeSection(key)?"done":"")+'"><b>'+(completeSection(key)?"✓":i+1)+'</b><span>'+e(label)+'</span></button>').join("");
 const index=SECTION_INFO.findIndex(x=>x[0]===currentSection);
 $("nextBlock").textContent=finishedSections()===8?"Повторить другой блок →":index===7?"К первому блоку →":"Следующий блок →";
}
function navMini(n,done){
 const idx=nowIndex(n);
 return '<div class="mini-nav">'+Array.from({length:n},(_,i)=>'<button type="button" data-action="question" data-i="'+i+'" class="'+(i===idx?"selected ":"")+(done[i]?"done":"")+'" aria-label="Задание '+(i+1)+(done[i]?", выполнено":"")+'">'+(done[i]?"✓":i+1)+'</button>').join("")+'</div>';
}
function nowIndex(n){
 let ix=Number(ui.index[currentSection]);
 if(!Number.isInteger(ix)||ix<0||ix>=n){let map=s()[currentSection]||{};ix=Array.from({length:n},(_,i)=>i).find(i=>!map[i]);if(ix===undefined)ix=0;ui.index[currentSection]=ix;}
 return ix;
}
function taskHeader(category,title,description,n){
 const i=nowIndex(n);
 return '<div class="task-top"><span class="task-kind">'+e(category)+'</span><span class="task-count">'+(i+1)+' из '+n+'</span></div><h3 class="task-title">'+e(title)+'</h3><p class="task-desc">'+e(description)+'</p>';
}
function shownDone(key,i){return !!s()[key][i];}
function sectionStory(){
 const l=L(),d=s(),n=l.story.length;
 let html=taskHeader("01 · СЛУШАЕМ","Сначала — живой английский","Нажми «Весь диалог», затем прослушай каждую реплику отдельно. Текст и перевод справа — твоя опора.",n);
 html+='<div class="action-bar"><button type="button" class="primary" data-action="playAll">▶ Слушать весь диалог</button><button type="button" class="outline" data-action="markStoryAll">Я прочитала весь текст</button></div>';
 html+='<div class="answers">'+l.story.map((p,i)=>'<button type="button" class="answer '+(d.story[i]?"correct":"")+'" data-action="storySpeak" data-i="'+i+'"><span class="letter">'+(d.story[i]?"✓":"▶")+'</span><span><b>'+e(p[0])+'</b><br><small>'+e(p[1])+'</small></span></button>').join("")+'</div>';
 html+='<p class="note">При прослушивании каждая реплика отмечается автоматически. Кнопка «Я прочитала» нужна, если озвучка в браузере не работает.</p>';
 return html;
}
function sectionCards(){
 const l=L(),i=nowIndex(l.words.length),w=l.words[i],done=s().cards[i];
 let html=taskHeader("02 · ЗАПОМИНАЕМ","12 слов для реальной жизни","Сначала послушай английское слово. Попробуй вспомнить перевод, затем открой карточку.",l.words.length);
 html+=navMini(l.words.length,s().cards);
 html+='<div class="word-card"><span class="word-sub">СЛОВО '+(i+1)+' · '+(done?"✓ ПРОСМОТРЕНО":"НОВОЕ")+'</span><div class="word-main">'+e(w[0])+'</div><button class="secondary" type="button" data-action="cardSpeak">🔊 Послушать слово</button>'+(ui.flipped||done?'<div class="word-trans">'+e(w[1])+'</div>':'<div class="word-sub">Перевод пока закрыт</div>')+'</div>';
 html+='<div class="action-bar"><button type="button" class="primary" data-action="cardFlip">'+(ui.flipped||done?"✓ Посмотрела перевод":"Показать перевод и запомнить")+'</button><button type="button" class="outline" data-action="cardNext">Следующее слово →</button></div>';
 html+='<p class="note">В пятницу эти слова встретятся снова, уже вперемешку. Одного просмотра недостаточно: дальше будут упражнения на память.</p>';
 return html;
}
function choicesHtml(options,right,section,index){
 const done=shownDone(section,index);
 return '<div class="answers">'+options.map((opt,i)=>'<button class="answer '+(done&&opt===right?"correct ":"")+(ui.wrong?.section===section&&ui.wrong.index===index&&ui.wrong.option===opt?"wrong":"")+'" type="button" data-action="choose" data-option="'+i+'"><span class="letter">'+String.fromCharCode(65+i)+'</span><span>'+e(opt)+'</span></button>').join("")+'</div>';
}
function sectionListen(){
 const l=L(),n=l.listen.length,i=nowIndex(n),line=l.listen[i],trans=l.story[line][1];
 const distract=l.story.filter((p,j)=>j!==line&&p[1]!==trans).map(p=>p[1]).slice(0,3);
 const options=optionShuffle([trans,...distract],(line+1)*91+i*13);
 let html=taskHeader("03 · ТРЕНИРУЕМ СЛУХ","Что ты услышала?","Послушай короткую фразу, выбери её значение. Не обязательно понимать каждое слово.",n);
 html+=navMini(n,s().listen);
 html+='<button type="button" class="listen-round" data-action="playListen" title="Прослушать фразу">▶</button><div class="helper-line">Нажми ▶, чтобы прослушать фразу. Можно слушать много раз.</div>';
 html+=choicesHtml(options,trans,"listen",i);
 if(shownDone("listen",i))html+='<p class="note">Верно! Прозвучало: <b>'+e(l.story[line][0])+'</b></p>';
 html+='<div class="action-bar"><button type="button" class="secondary" data-action="playSlow">🐢 Ещё медленнее</button>'+(!("speechSynthesis" in window)?'<button type="button" class="outline" data-action="showListen">Показать текст</button>':"")+'</div>';
 return html;
}
function sectionUnderstand(){
 const l=L(),n=l.questions.length,i=nowIndex(n),q=l.questions[i],right=q[1][q[2]];
 let html=taskHeader("04 · ЧИТАЕМ С ПОНИМАНИЕМ","Понимаю смысл","Прочитай диалог в шпаргалке и ответь на вопросы. Можно возвращаться к тексту.",n);
 html+=navMini(n,s().understand);
 html+='<div class="prompt"><small>ВОПРОС</small>'+e(q[0])+'</div>';
 html+=choicesHtml(q[1],right,"understand",i);
 return html;
}
function tokens(target,seed){
 return optionShuffle(target.trim().split(/\s+/).map((word,i)=>({word,index:i})),seed);
}
function sectionBuild(){
 const l=L(),n=l.build.length,i=nowIndex(n),item=l.build[i],bank=tokens(item[0],i*113+51);
 const chosen=ui.picked||[];
 let html=taskHeader("05 · СОБИРАЕМ","Построй английскую фразу","Нажимай слова в нужном порядке. Если ошиблась, убери слово из строки, нажав на него.",n);
 html+=navMini(n,s().build);
 html+='<div class="prompt"><small>СКАЖИ ПО-АНГЛИЙСКИ</small>'+e(item[1])+'</div>';
 html+='<div class="sentence-area">'+(chosen.length?chosen.map((n,j)=>'<button type="button" class="token-chip in-sentence" data-action="removeToken" data-i="'+j+'">'+e(item[0].split(/\s+/)[n])+'</button>').join(""):'<span class="placeholder">Здесь появится твоя фраза...</span>')+'</div>';
 html+='<div class="token-bank">'+bank.map(t=>'<button class="token-chip '+(chosen.includes(t.index)?"used":"")+'" type="button" data-action="addToken" data-i="'+t.index+'" '+(chosen.includes(t.index)?"disabled":"")+'>'+e(t.word)+'</button>').join("")+'</div>';
 html+='<div class="action-bar"><button type="button" class="primary" data-action="checkBuild">Проверить фразу</button><button type="button" class="outline" data-action="clearTokens">Очистить</button><button type="button" class="ghost" data-action="buildHint">Подсказка</button></div>';
 if(shownDone("build",i))html+='<p class="note">✓ Верный вариант: <b>'+e(item[0])+'</b> <button class="subtle-button" type="button" data-action="playBuild">🔊 Слушать</button></p>';
 return html;
}
function sectionWrite(){
 const l=L(),n=l.write.length,i=nowIndex(n),q=l.write[i];
 let html=taskHeader("06 · ВСПОМИНАЕМ САМИ","Напиши по-английски","Попробуй написать короткую фразу без подсказок. Можно использовать голосовой ввод, исправить распознавание и проверить текст.",n);
 html+=navMini(n,s().write);
 html+='<div class="prompt"><small>ПЕРЕВЕДИ НА АНГЛИЙСКИЙ</small>'+e(q[0])+'</div>';
 html+='<input id="writeInput" class="write-input" type="text" autocomplete="off" autocapitalize="sentences" placeholder="Напиши фразу на английском..." aria-label="Английский перевод">';
 html+='<div class="action-bar"><button type="button" class="primary" data-action="checkWrite">Проверить</button><button type="button" class="secondary" data-action="voiceWrite">🎤 Ответить голосом</button><button type="button" class="ghost" data-action="writeHint">Подсказка</button></div>';
 html+='<p class="note">Распознавание голоса может ошибаться. Проверь слова в поле перед отправкой.</p>';
 if(shownDone("write",i))html+='<p class="note">✓ Правильный ответ: <b>'+e(q[1])+'</b> <button class="subtle-button" type="button" data-action="playWrite">🔊 Слушать</button></p>';
 return html;
}
function sectionSpeak(){
 const l=L(),n=l.speak.length,i=nowIndex(n),q=l.speak[i];
 let html=taskHeader("07 · ГОВОРИМ БЕЗ СТРАХА","Маленькая разговорная практика","Сначала послушай, затем произнеси фразу вслух 2–3 раза. Микрофон — по желанию, произношение автоматически не оцениваем.",n);
 html+=navMini(n,s().speak);
 html+='<div class="speak-box"><div class="microphone">🎙️</div><div class="speak-en">'+e(q[0])+'</div><div class="speak-ru">'+e(q[1])+'</div></div>';
 html+='<div class="action-bar"><button type="button" class="secondary" data-action="speakSample">🔊 Послушать</button><button type="button" class="outline" data-action="speakSlow">🐢 Медленно</button><button type="button" class="outline" data-action="recordSpeak">🎤 Попробовать микрофон</button><button type="button" class="primary" data-action="markSpeak">'+(shownDone("speak",i)?"✓ Я сказала":"✓ Я произнесла вслух")+'</button></div>';
 html+='<div class="transcript" id="recognitionStatus">Можно говорить тихо, не торопясь и без микрофона. Главное — попробовать вслух.</div>';
 return html;
}
function sectionRecall(){
 const l=L(),n=l.words.length,i=nowIndex(n),w=l.words[i],wrong=optionShuffle(l.words.filter((p,j)=>j!==i).map(p=>p[1]),i*23+19).slice(0,3);
 const options=optionShuffle([w[1],...wrong],i*67+33);
 let html=taskHeader("08 · ЗАКРЕПЛЯЕМ","Проверка памяти","Вспомни значение английского слова. Если ошибёшься, попробуй снова. Пятничное повторение покажет, что осталось в памяти.",n);
 html+=navMini(n,s().recall);
 html+='<div class="word-card" style="min-height:145px"><div class="word-main">'+e(w[0])+'</div><button type="button" class="secondary" data-action="recallSpeak">🔊 Произнести</button></div>';
 html+=choicesHtml(options,w[1],"recall",i);
 if(shownDone("recall",i))html+='<p class="note">✓ Запомнила: '+e(w[0])+' — '+e(w[1])+'</p>';
 return html;
}
const RENDERS={story:sectionStory,cards:sectionCards,listen:sectionListen,understand:sectionUnderstand,build:sectionBuild,write:sectionWrite,speak:sectionSpeak,recall:sectionRecall};
function renderExercise(){
 $("exerciseBody").innerHTML=RENDERS[currentSection]();
 const inp=$("writeInput");
 if(inp)inp.addEventListener("keydown",ev=>{if(ev.key==="Enter"){ev.preventDefault();checkWrite();}});
 renderMessage();
}
function renderFinish(){
 const d=s(),n=finishedSections(),needs=minutes(L())*60-d.seconds,errors=d.attempts.filter(a=>!a.correct).length;
 const total=SECTION_INFO.length;
 let html="";
 if(d.finished){
  const difficult=Object.entries(d.attempts.filter(a=>!a.correct&&a.word).reduce((m,a)=>(m[a.word]=(m[a.word]||0)+1,m),{})).sort((a,b)=>b[1]-a[1]).slice(0,5).map(x=>x[0]);
  html='<div class="finish-box complete"><h3>🎉 '+(L().review?"Первая неделя завершена!":"Урок завершён!")+'</h3><p>Засчитано '+fmt(d.seconds)+' активного времени. Ошибок за попытки: '+errors+'. '+(difficult.length?"Повтори особенно: "+e(difficult.join(", "))+". ":"")+'Прогресс сохранён.</p></div>';
 }else if(n===total && needs>0){
  html='<div class="finish-box"><h3>Все задания выполнены — отличная работа</h3><p>До полного занятия осталось '+fmt(needs)+' активного времени. Послушай диалог ещё раз, потренируй трудные слова или повтори разговорные фразы. Таймер идёт при активной работе на вкладке.</p></div>';
 }else{
  html='<div class="finish-box"><h3>'+n+' из '+total+' блоков выполнено</h3><p>Проходи упражнения в любом порядке, ответы сохраняются автоматически. День считается завершённым после всех восьми блоков и '+minutes(L())+' минут активной работы. Текущие ошибки: '+errors+'.</p></div>';
 }
 $("finishPanel").innerHTML=html;
}
function render(){if(!LESSONS.length)return;maybeFinish();renderDayStrip();renderStats();renderReference();renderNav();renderExercise();renderFinish();}
function markAndRender(key,idx,answer,word){
 const d=s();if(!d[key][idx]){d[key][idx]=true;record(key,idx,answer,true,word);}else save();
 ui.wrong=null;ui.message="✓ Верно! Можно выбрать следующее задание.";ui.messageKind="ok";maybeFinish();render();
}
function wrongAnswer(key,idx,answer,correct,word){
 record(key,idx,answer,false,word);
 ui.wrong={section:key,index:idx,option:answer};
 setMessage("Почти! Это не тот вариант. Послушай или посмотри текст и попробуй ещё раз.","error");
}
function pickChoice(btn){
 const key=currentSection,idx=nowIndex(key==="listen"?L().listen.length:key==="understand"?L().questions.length:L().words.length);
 let opts,right,word="";
 if(key==="listen"){
  const k=L().listen[idx],t=L().story[k][1],d=L().story.filter((p,j)=>j!==k&&p[1]!==t).map(p=>p[1]).slice(0,3);
  opts=optionShuffle([t,...d],(k+1)*91+idx*13);right=t;word=L().story[k][0];
 }else if(key==="understand"){const q=L().questions[idx];opts=q[1];right=opts[q[2]];}
 else if(key==="recall"){
  word=L().words[idx][0];right=L().words[idx][1];
  const wrong=optionShuffle(L().words.filter((p,j)=>j!==idx).map(p=>p[1]),idx*23+19).slice(0,3);
  opts=optionShuffle([right,...wrong],idx*67+33);
 }else return;
 const opt=opts[Number(btn.dataset.option)];
 active();
 if(opt===right)markAndRender(key,idx,opt,key==="recall"?word:null);
 else wrongAnswer(key,idx,opt,right,key==="recall"?word:null);
}
function checkBuild(){
 const i=nowIndex(L().build.length),q=L().build[i],words=q[0].split(/\s+/);
 const answer=ui.picked.map(j=>words[j]).join(" ");
 if(!answer){setMessage("Сначала выбери слова снизу.","error");return;}
 const ok=normalize(answer)===normalize(q[0]);
 if(ok){markAndRender("build",i,answer);speak(q[0]);}
 else{record("build",i,answer,false);setMessage("Пока не получилось. Попробуй поменять порядок слов или возьми подсказку.","error");}
}
function checkWrite(){
 const i=nowIndex(L().write.length),q=L().write[i],value=$("writeInput")?.value.trim()||"";
 if(!value){setMessage("Напиши хотя бы пару слов.","error");return;}
 const ok=q[2].some(t=>normalize(t)===normalize(value));
 if(ok){markAndRender("write",i,value);speak(q[1]);}
 else{record("write",i,value,false);setMessage("Не совсем так. Проверь порядок слов и артикли, либо нажми «Подсказка». Можно исправлять сколько угодно.","error");}
}
function speak(text,onend,rateOverride){
 active();
 if(!("speechSynthesis" in window)||!("SpeechSynthesisUtterance" in window)){
  setMessage("В этом браузере нет английской озвучки. Попробуй Chrome или Edge. Текст всегда есть в шпаргалке.","error");return false;
 }
 try{
  window.speechSynthesis.cancel();playing=false;
  const u=new SpeechSynthesisUtterance(text);
  const lang=state.settings.accent||"en-GB";
  u.lang=lang;u.rate=rateOverride||Number(state.settings.rate||0.85);u.pitch=1;
  const all=window.speechSynthesis.getVoices();
  const voice=all.find(v=>v.lang.toLowerCase()===lang.toLowerCase())||all.find(v=>v.lang.toLowerCase().startsWith("en"));
  if(voice)u.voice=voice;
  u.onstart=()=>{playing=true;active();};
  u.onend=()=>{playing=false;active();if(typeof onend==="function")onend();};
  u.onerror=ev=>{playing=false;if(ev.error!=="interrupted"&&ev.error!=="canceled")setMessage("Браузер не смог произнести фразу. Попробуй ещё раз или используй текст.","error");};
  window.speechSynthesis.speak(u);return true;
 }catch(err){playing=false;setMessage("Озвучка не запустилась: "+err.message,"error");return false;}
}
function markStory(i){
 if(!s().story[i]){s().story[i]=true;record("story",i,"Прослушала реплику",true);}render();
}
function stopRecognition(){try{if(recognizer){recognizer.abort();recognizer=null;}}catch(_){}}
function recognize(target){
 active();const Rec=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Rec){setMessage("В этом браузере микрофонное распознавание недоступно. Можно произнести вслух и отметить вручную. Для микрофона попробуй Chrome.","error");return;}
 stopRecognition();
 try{
  const rec=new Rec();recognizer=rec;rec.lang=state.settings.accent||"en-GB";rec.interimResults=false;rec.continuous=false;rec.maxAlternatives=3;
  if(target==="speak"){
   const el=$("recognitionStatus");if(el)el.textContent="🎤 Слушаю тебя... Говори в комфортном темпе.";
  }else setMessage("🎤 Слушаю. Когда закончишь, проверь распознанный текст в поле.","ok");
  rec.onresult=evt=>{
   if(!evt.results?.length)return;
   const heard=evt.results[0][0]?.transcript||"";
   if(target==="write"){const inp=$("writeInput");if(inp){inp.value=heard;inp.focus();}}
   else{
    const el=$("recognitionStatus");if(el)el.textContent='Браузер услышал: «'+heard+'». Если получилось не идеально — это нормально. Это НЕ оценка произношения.';
    const i=nowIndex(L().speak.length);
    if(!s().speak[i]){s().speak[i]=true;record("speak",i,"Через микрофон: "+heard,true);renderStats();renderNav();renderFinish();}
   }
   active();
  };
  rec.onerror=evt=>{
   const help={ "not-allowed":"Доступ к микрофону запрещён в браузере.","network":"Нет связи с сервисом распознавания.","no-speech":"Речь не распознана.","audio-capture":"Не найден микрофон."};
   setMessage((help[evt.error]||"Микрофон: "+evt.error)+ " Попробуй снова или отмечай произнесённые фразы вручную.","error");
  };
  rec.onend=()=>{if(recognizer===rec)recognizer=null;};
  rec.start();
 }catch(err){recognizer=null;setMessage("Микрофон не запустился: "+err.message+". Можно обойтись без него.","error");}
}
function nextQuestion(){
 let n=currentSection==="story"?L().story.length:currentSection==="cards"||currentSection==="recall"?L().words.length:currentSection==="listen"?L().listen.length:currentSection==="understand"?L().questions.length:currentSection==="build"?L().build.length:currentSection==="write"?L().write.length:L().speak.length;
 let current=nowIndex(n),done=s()[currentSection];
 for(let offset=1;offset<=n;offset++){let k=(current+offset)%n;if(!done[k]){ui.index[currentSection]=k;ui.flipped=false;ui.picked=[];render();return;}}
 ui.index[currentSection]=(current+1)%n;ui.flipped=false;ui.picked=[];render();
}
function onAction(button){
 const a=button.dataset.action,i=Number(button.dataset.i||0),d=s(),lesson=L();active();
 if(a==="question"){ui.index[currentSection]=i;ui.flipped=false;ui.picked=[];ui.wrong=null;ui.message="";render();return;}
 if(a==="refSpeak"||a==="storySpeak"){const line=lesson.story[i];speak(line[0],()=>{if(a==="storySpeak"&&currentSection==="story")markStory(i);});return;}
 if(a==="speakWordRef"){speak(lesson.words[i][0]);return;}
 if(a==="playAll"){speak(lesson.story.map(x=>x[0]).join(" "),()=>{lesson.story.forEach((p,j)=>{if(!d.story[j]){d.story[j]=true;record("story",j,"Прослушала весь диалог",true);}});ui.message="✓ Диалог прослушан. Попробуй повторить несколько фраз вслух.";ui.messageKind="ok";render();});return;}
 if(a==="markStoryAll"){lesson.story.forEach((p,j)=>{if(!d.story[j]){d.story[j]=true;record("story",j,"Прочитала без аудио",true);}});ui.message="Текст прочитан. Если звук заработает, попробуй ещё послушать диалог.";ui.messageKind="ok";render();return;}
 if(a==="cardSpeak"){speak(lesson.words[nowIndex(lesson.words.length)][0]);return;}
 if(a==="cardFlip"){const k=nowIndex(lesson.words.length);ui.flipped=true;if(!d.cards[k]){d.cards[k]=true;record("cards",k,"Посмотрела перевод",true,lesson.words[k][0]);}speak(lesson.words[k][0]);render();return;}
 if(a==="cardNext"){nextQuestion();return;}
 if(a==="playListen"||a==="playSlow"){const k=lesson.listen[nowIndex(lesson.listen.length)];speak(lesson.story[k][0],null,a==="playSlow"?0.68:null);return;}
 if(a==="showListen"){const k=lesson.listen[nowIndex(lesson.listen.length)];setMessage("Текст фразы: "+lesson.story[k][0],"ok");return;}
 if(a==="choose"){pickChoice(button);return;}
 if(a==="addToken"){if(!ui.picked.includes(i)){ui.picked.push(i);render();}return;}
 if(a==="removeToken"){ui.picked.splice(i,1);render();return;}
 if(a==="clearTokens"){ui.picked=[];render();return;}
 if(a==="checkBuild"){checkBuild();return;}
 if(a==="buildHint"){const q=lesson.build[nowIndex(lesson.build.length)][0];setMessage("Подсказка: первые слова — «"+q.split(/\s+/).slice(0,2).join(" ")+" ...»","ok");return;}
 if(a==="playBuild"){speak(lesson.build[nowIndex(lesson.build.length)][0]);return;}
 if(a==="writeHint"){const q=lesson.write[nowIndex(lesson.write.length)][1];setMessage("Начало правильного ответа: «"+q.split(/\s+/).slice(0,2).join(" ")+" ...»","ok");return;}
 if(a==="voiceWrite"){recognize("write");return;}
 if(a==="checkWrite"){checkWrite();return;}
 if(a==="playWrite"){speak(lesson.write[nowIndex(lesson.write.length)][1]);return;}
 if(a==="speakSample"||a==="speakSlow"){speak(lesson.speak[nowIndex(lesson.speak.length)][0],null,a==="speakSlow"?0.7:null);return;}
 if(a==="recordSpeak"){recognize("speak");return;}
 if(a==="markSpeak"){const k=nowIndex(lesson.speak.length);if(!d.speak[k]){d.speak[k]=true;record("speak",k,"Произнесла вслух",true);}ui.message="✓ Отлично. Даже тихо и с паузами — это уже практика.";ui.messageKind="ok";render();return;}
 if(a==="recallSpeak"){speak(lesson.words[nowIndex(lesson.words.length)][0]);return;}
}
function exportProgress(){
 const output={app:"tanya-english-v1",exportedAt:new Date().toISOString(),progress:state};
 const blob=new Blob([JSON.stringify(output,null,2)],{type:"application/json;charset=utf-8"});
 const url=URL.createObjectURL(blob),link=document.createElement("a");
 link.href=url;link.download="my-english-progress-"+localToday()+".json";document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function importProgress(file){
 if(!file)return;
 try{
  if(file.size>4*1024*1024)throw Error("Файл слишком большой.");
  const data=JSON.parse(await file.text());
  if(data.app!=="tanya-english-v1"||!data.progress||!data.progress.days)throw Error("Это не резервная копия данного приложения.");
  if(!window.confirm("Заменить текущие результаты данными из резервной копии?"))return;
  state=data.progress;state.days=state.days||{};state.vocab=state.vocab||{};state.settings=state.settings||{};state.version=1;
  selectedId=LESSONS.some(l=>l.id===state.selected)?state.selected:LESSONS[0].id;
  currentSection=state.days[selectedId]?.section||"story";
  resetUI();save();render();setMessage("Резервная копия восстановлена.","ok");
 }catch(err){window.alert("Не удалось восстановить прогресс: "+err.message);}finally{$("importProgress").value="";}
}
document.addEventListener("click",ev=>{
 const b=ev.target.closest("button[data-action],button[data-day],button[data-section]");
 if(!b)return;
 if(b.dataset.day){switchDay(b.dataset.day);return;}
 if(b.dataset.section){switchSection(b.dataset.section);return;}
 if(b.dataset.action)onAction(b);
});
document.addEventListener("keydown",active);
document.addEventListener("pointerdown",active);
$("nextBlock").addEventListener("click",()=>{
 const idx=SECTION_INFO.findIndex(x=>x[0]===currentSection);
 for(let offset=1;offset<=SECTION_INFO.length;offset++){
  const next=SECTION_INFO[(idx+offset)%SECTION_INFO.length][0];
  if(!completeSection(next)){switchSection(next);return;}
 }
 switchSection(SECTION_INFO[(idx+1)%SECTION_INFO.length][0]);
});
$("soundTest").addEventListener("click",()=>speak("Hello! You can learn English, one step at a time."));
$("voiceRate").value=state.settings.rate||"0.85";
$("rateLabel").textContent=Number($("voiceRate").value).toFixed(2)+"×";
$("voiceRate").addEventListener("input",ev=>{state.settings.rate=Number(ev.target.value);$("rateLabel").textContent=state.settings.rate.toFixed(2)+"×";save();active();});
$("accent").value=state.settings.accent||"en-GB";
$("accent").addEventListener("change",ev=>{state.settings.accent=ev.target.value;save();active();});
$("exportProgress").addEventListener("click",exportProgress);
$("importProgress").addEventListener("change",ev=>importProgress(ev.target.files?.[0]));
setInterval(()=>{
 const now=Date.now();
 const span=Math.min(2,Math.max(0,(now-lastTick)/1000));
 lastTick=now;
 if(document.visibilityState==="visible" && document.hasFocus() && (now-lastAction<120000||playing)){
  const d=s();if(!d.finished){d.seconds+=span;if(Math.floor(d.seconds)%5===0)save();}
 }
 if(maybeFinish()){render();}
 else {renderStats();renderFinish();}
},1000);
window.addEventListener("pagehide",save);
window.addEventListener("visibilitychange",()=>{lastTick=Date.now();save();});
if(!LABELS[currentSection])currentSection="story";
render();
})();