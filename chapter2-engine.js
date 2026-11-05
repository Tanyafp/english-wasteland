/* English Wasteland Chapter 2 — saved, varied, spoken missions. */
(()=>{
'use strict';
const D=window.EW2_DATA;if(!D){document.body.textContent='Не удалось загрузить задания главы 2';return}
const $=id=>document.getElementById(id), words=D.words,areas=D.areas,tasks=D.tasks;
const KEY='english_wasteland_chapter2_v1', FIRST='english_wasteland_vault27_v1';
const fresh=()=>({stage:0,xp:0,caps:0,learned:[],inventory:[],attempts:[],homeworkHistory:[],checkpointAcknowledge:{},hwActive:null,sound:true});
function load(){try{const saved=JSON.parse(localStorage.getItem(KEY));if(!saved)return fresh();return {...fresh(),...saved,stage:Math.min(48,Math.max(0,Number(saved.stage)||0)),learned:Array.isArray(saved.learned)?saved.learned:[],inventory:Array.isArray(saved.inventory)?saved.inventory:[],attempts:Array.isArray(saved.attempts)?saved.attempts:[],homeworkHistory:Array.isArray(saved.homeworkHistory)?saved.homeworkHistory:[]}}catch{return fresh()}}
let state=load(),mode=state.hwActive||null,working=null,success=null,syncTimer=null,syncBusy=false,assigned=null,toastTimer=null;
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function toast(t){$('toast').textContent=t;$('toast').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),3700)}
function speak(s,slow=false){if(!s)return;if(!('speechSynthesis' in window)){toast('Озвучка недоступна в браузере');return}try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(String(s));u.lang='en-US';u.rate=slow?.60:.8;u.pitch=1.04;const voices=speechSynthesis.getVoices(),en=voices.find(v=>v.lang&&v.lang.toLowerCase().startsWith('en-us'))||voices.find(v=>v.lang&&v.lang.toLowerCase().startsWith('en'));if(en)u.voice=en;speechSynthesis.speak(u)}catch{toast('Браузер не смог произнести эту фразу')}}
function save(){state.hwActive=mode;try{localStorage.setItem(KEY,JSON.stringify(state))}catch{};scheduleSync()}
function scheduleSync(){if(!window.EWCloud?.configured||!localStorage.getItem('ew-child-id'))return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>sync(true),1300)}
function uid(){return (crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(16).slice(2))}
function record(t,word,correct,given,expected){state.attempts.push({id:uid(),chapter:2,taskId:t.id,kind:mode?'homework':'story',skill:t.kind,word:String(word||t.word).toUpperCase(),correct:!!correct,given:String(given),expected:String(expected),hintUsed:!!working?.hint,at:new Date().toISOString(),synced:false});save()}
function currentTask(){return mode?mode.items[mode.index]:tasks[state.stage]||null}
function ensureWorking(){const task=currentTask();if(!task)return;const key=(mode?'hw:'+mode.key+':'+mode.index:'story:'+state.stage);if(!working||working.key!==key)working={key,hint:false,tokens:[],left:null,matched:{},feedback:'',feedbackType:''};return working}
function currentArea(){const i=mode?.area!=null?mode.area:Math.min(3,Math.floor(Math.min(state.stage,47)/12));return Math.max(0,Math.min(3,i))}
function learn(w){if(words[w]&&!state.learned.includes(w))state.learned.push(w)}
function logAndCheck(t,given,expected,word){const correct=String(given).trim().toUpperCase()===String(expected).trim().toUpperCase();record(t,word||t.word,correct,given,expected);if(correct){learn(word||t.word);finishTask(t);return}working.feedback='Пока нет. Попробуй ещё раз — штрафа нет.';working.feedbackType='bad';renderTask()}
function finishTask(t){if(mode){mode.correct++;mode.index++;if(mode.index>=mode.items.length){const end={title:mode.title,correct:mode.correct,total:mode.items.length};state.homeworkHistory.push({at:new Date().toISOString(),title:mode.title,key:mode.key,correct:mode.correct,total:mode.items.length,chapter:2});state.xp+=22;state.caps+=4;mode=null;state.hwActive=null;success={type:'homework',...end}}else{state.hwActive=mode;success=null}}
else{const old=state.stage;state.stage=Math.min(48,state.stage+1);state.xp+=12;state.caps+=2;if(state.stage%12===0){const area=areas[old/12|0];if(!state.inventory.includes(area.reward))state.inventory.push(area.reward)}success={type:'story',title:t.q,oldStage:old}}
working=null;save();render()}
function renderTask(){const box=$('taskBox'),t=currentTask();if(!t){renderEnding();return}const w=ensureWorking();let kind=t.kind,html='';
const area=areas[currentArea()];
const tag=mode?'ДОМАШНЕЕ ЗАДАНИЕ':'СЮЖЕТНОЕ ЗАДАНИЕ';
html+='<div class="modehead"><div><div class="label">'+tag+'</div><h2>'+esc(mode?mode.title:'Миссия '+String(state.stage+1).padStart(2,'0')+' / 48')+'</h2></div><span class="chip">'+esc(mode?(mode.index+1)+' / '+mode.items.length:area.name)+'</span></div>';
if(kind==='dialogue')html+='<div class="robot">🤖 БОТ-7: <b>'+esc(t.say)+'</b></div>';
else if(kind==='listen')html+='<div class="listen">📡 Голосовое сообщение. Сначала послушай, потом выбери ответ. <strong>Текст скрыт.</strong></div>';
html+='<p class="question">'+esc(t.q)+'</p>';
html+='<div class="controls"><button class="btn secondary" data-a="play">🔊 Слушать</button><button class="btn secondary" data-a="slow">🐢 Медленно</button><button class="btn gold" data-a="hint">💡 Подсказка</button></div>';
if(['pick','listen','visual','dialogue'].includes(kind)){html+='<div class="choices '+(kind==='visual'?'visual':'')+'">'+t.opts.map((option,i)=>'<button class="choice" data-a="option" data-i="'+i+'">'+esc(option)+'</button>').join('')+'</div>'}
if(kind==='type')html+='<form id="typeForm"><label class="sub" for="typedAnswer">Напиши слово английскими буквами (можно маленькими):</label><input class="answerfield" id="typedAnswer" type="text" maxlength="70" spellcheck="false" autocomplete="off" autocapitalize="characters" placeholder="Твой ответ" required><div class="controls"><button class="btn primary" type="submit">Проверить</button></div></form>';
if(kind==='order'||kind==='sequence'){const tokens=kind==='sequence'?t.opts:t.tokens;html+='<div class="sub">Нажимай на карточки в правильном порядке. Нажатые карточки можно убрать.</div><div class="toklist"><span class="built">'+(w.tokens.length?w.tokens.map(i=>esc(tokens[i])).join(' · '):'Собери предложение здесь')+'</span></div><div class="toklist">'+tokens.map((text,i)=>'<button class="token '+(w.tokens.includes(i)?'used':'')+'" '+(w.tokens.includes(i)?'disabled':'')+' data-a="token" data-i="'+i+'">'+esc(text)+'</button>').join('')+'</div><div class="controls"><button class="btn primary" data-a="checkOrder">✓ Проверить команду</button><button class="btn secondary" data-a="resetTokens">↺ Сначала</button></div>'}
if(kind==='match'){const available=t.pairs||[];const right=[...available].reverse();html+='<p class="sub">Сначала выбери английское слово слева, потом русский перевод справа.</p><div class="matches"><div class="matchcol">'+available.map(pair=>'<button '+(w.matched[pair[0]]?'disabled':'')+' class="'+(w.left===pair[0]?'selected ':'')+(w.matched[pair[0]]?'solved':'')+'" data-a="matchLeft" data-v="'+esc(pair[0])+'">'+esc(pair[0])+(w.matched[pair[0]]?' ✓':'')+'</button>').join('')+'</div><div class="matchcol">'+right.map(pair=>'<button '+(w.matched[pair[0]]?'disabled':'')+' class="'+(w.matched[pair[0]]?'solved':'')+'" data-a="matchRight" data-v="'+esc(pair[0])+'">'+esc(pair[1])+(w.matched[pair[0]]?' ✓':'')+'</button>').join('')+'</div></div>'}
if(w.hint){html+='<div class="notice">💡 '+esc(t.kind==='match'?'Начни с простых пар. Подсказка: '+t.pairs.map(x=>x[0]+' — '+x[1]).join('; '):((words[t.word]||'Вспомни слова из словаря')+'. '+((kind==='type')?'Первая буква: '+String(t.answer)[0]+'.':(kind==='order'||kind==='sequence')?'Слушай фразу и сверяй порядок.':'Послушай ещё раз.')))+'</div>'}
html+='<p class="feedback '+(w.feedbackType||'')+'" id="feedback">'+esc(w.feedback||'Ошибаться можно: система запомнит сложные слова и предложит повторение.')+'</p>';
if(mode)html+='<button class="btn secondary" data-a="leaveHomework">↩ Вернуться к сюжету (задание сохранится)</button>';
box.innerHTML=html;
}
function renderEnding(){const e=$('taskBox');if(state.stage<48&&mode===null)return;
 e.innerHTML='<h2>🏆 Глава 2 пройдена!</h2><p>Ты помог роботу найти припасы, включил свет, получил радиосигнал и выбрал безопасный маршрут. Отличная работа!</p><div class="controls"><button class="btn primary" data-a="finalHomework">📝 Итоговая проверка</button><button class="btn secondary" data-a="personalHomework">🎯 Повторить трудные слова</button></div><p class="sub">Можно возвращаться к заданиям и практиковаться, даже когда сюжет завершён.</p>'}
function renderSuccess(){const box=$('taskBox');if(!success)return;let text='',button='Продолжить →';if(success.type==='homework'){text='<h2>📝 Проверка завершена</h2><p>'+esc(success.title)+'</p><div class="notice">Выполнено '+success.correct+' / '+success.total+'. В журнале сохранены все попытки, включая ошибки и подсказки.</div>';button='Вернуться к игре'}
else if(success.type==='story'){const n=success.oldStage+1;text='<h2>✅ Задание выполнено!</h2><p>+12 XP · +2 крышечки. Миссия '+n+' из 48 закрыта.</p>';if(n%12===0){const a=areas[n/12-1];text+='<div class="notice">Зона «'+esc(a.name)+'» пройдена! В рюкзак добавлено: '+esc(a.reward)+'. Теперь доступно домашнее задание на закрепление.</div>';button='Посмотреть следующую зону →'}}
box.innerHTML=text+'<div class="controls"><button class="btn primary" data-a="continue">'+button+'</button></div>';
}
function renderCheckpoint(){const a=areas[state.stage/12-1],z=state.stage/12-1;
 $('taskBox').innerHTML='<div class="label">ЗОНА ЗАВЕРШЕНА</div><h2>🎖️ '+esc(a.name)+' освоен</h2><p>Ты получил '+esc(a.reward)+'. Прежде чем идти дальше, попробуй закрепить слова: слух, перевод, письмо и пары.</p><div class="controls"><button class="btn primary" data-a="checkpointHomework" data-zone="'+z+'">📝 Закрепить 6 заданиями</button><button class="btn secondary" data-a="checkpointNext">Продолжить сюжет →</button></div><small class="help">Домашнее задание можно сделать позже и повторять сколько угодно раз.</small>';
}
function renderScene(){const zi=currentArea(),a=areas[zi],props=[
 [['📦','BOX'],['🎒','BAG'],['💧','WATER'],['🧰','HELP']],
 [['💡','LIGHT'],['🔘','BUTTON'],['⚡','ON'],['🌑','DARK']],
 [['📻','LISTEN'],['🎙️','SPEAK'],['📡','WHERE'],['🤝','FRIEND']],
 [['🧭','LEFT'],['🗺️','MAP'],['🚪','EXIT'],['✅','SAFE']]
 ][zi];
 $('zoneLabel').textContent='ЗОНА '+String(zi+1).padStart(2,'0')+' / 04';
 $('zoneTitle').textContent=a.icon+' '+a.name+' — '+a.subtitle;
 $('sceneName').textContent=a.name.toUpperCase();
 $('zoneIntro').textContent=a.intro;
 $('props').innerHTML=props.map((x,i)=>'<button class="prop" data-prop="'+i+'" title="Нажми, чтобы услышать слово"><span>'+x[0]+'</span><small>🔊 '+x[1]+'</small></button>').join('');
 $('props').querySelectorAll('button').forEach(b=>b.onclick=()=>{const v=props[Number(b.dataset.prop)][1];speak(v);toast(v+' — '+(words[v]||''))});
 $('bar').style.width=Math.round(state.stage/tasks.length*100)+'%';
 $('progressLabel').textContent=state.stage+' / 48 миссий · '+Math.round(state.stage/tasks.length*100)+'% главы';
 $('statStage').textContent=state.stage+'/48';$('statXp').textContent=state.xp+' XP';$('statCaps').textContent=state.caps+' ⬡';
 const total=areas.flatMap(x=>x.words);$('statWords').textContent=String(total.filter(w=>state.learned.includes(w)).length)+' / 32';
 $('zones').innerHTML=areas.map((zone,i)=>'<div class="zonecard '+(i===zi?'current ':((i+1)*12<=state.stage?'':'locked'))+'"><span class="zoneicon">'+zone.icon+'</span><div><b>'+esc(zone.name)+'</b><small>'+esc(zone.subtitle)+' · '+(state.stage>=(i+1)*12?'✓ Завершена':state.stage>=i*12?'В процессе':'Закрыта')+'</small></div></div>').join('');
 $('bag').innerHTML=state.inventory.length?state.inventory.map(x=>'<span class="chip">'+esc(x)+'</span>').join(''):'<small class="help">Собирай предметы по мере прохождения зон.</small>';
 $('vocabulary').innerHTML=state.learned.length?'<small class="help">Нажми на слово, чтобы услышать произношение.</small><div>'+state.learned.map(w=>'<button class="chip" data-word="'+esc(w)+'">'+esc(w)+' · '+esc(words[w]||'')+'</button>').join('')+'</div>':'<small class="help">Изученные слова появятся здесь.</small>';
 $('vocabulary').querySelectorAll('[data-word]').forEach(b=>b.onclick=()=>speak(b.dataset.word));
 const hw=areas.map((zone,i)=>'<button class="btn secondary hwbtn" data-hw="zone-'+i+'" '+(state.stage<(i+1)*12?'disabled':'')+'>📝 '+esc(zone.name)+' — 6 проверок '+(state.homeworkHistory.some(x=>x.key==='zone-'+i)?'✓':'')+'</button>').join('');
 let extra='<button class="btn secondary hwbtn" data-hw="personal" '+(state.stage<4?'disabled':'')+'>🎯 Персональная тренировка</button>';
 if(state.stage===48)extra+='<button class="btn gold hwbtn" data-hw="final">🏆 Итоговый экзамен — 12 вопросов</button>';
 if(assigned?.words?.length)extra+='<button class="btn primary hwbtn" data-hw="assigned">📨 Задание от родителя: '+esc(assigned.title||'Повторение')+'</button>';
 $('hwPanel').innerHTML=hw+extra+(mode?'<p class="notice">Сейчас выполняется: '+esc(mode.title)+'</p>':'');
 $('hwPanel').querySelectorAll('[data-hw]').forEach(b=>b.onclick=()=>beginHomework(b.dataset.hw));
}
function render(){renderScene();if(success){renderSuccess();return}if(mode){renderTask();return}if(state.stage>0&&state.stage%12===0&&!state.checkpointAcknowledge[state.stage]){renderCheckpoint();return}if(state.stage>=48){renderEnding();return}renderTask()}
function onAction(e){const el=e.target.closest('[data-a]');if(!el)return;const a=el.dataset.a;
 if(a==='continue'){success=null;render();return}
 if(a==='checkpointNext'){state.checkpointAcknowledge[state.stage]=true;save();render();return}
 if(a==='checkpointHomework'){beginHomework('zone-'+el.dataset.zone);return}
 if(a==='personalHomework'){beginHomework('personal');return}
 if(a==='finalHomework'){beginHomework('final');return}
 if(a==='leaveHomework'){state.hwActive=mode;mode=null;working=null;success=null;save();render();toast('Домашнее задание сохранено — продолжишь позже');return}
 const task=currentTask();if(!task)return;ensureWorking();
 if(a==='play'||a==='slow'){speak(task.say||task.answer,a==='slow');return}
 if(a==='hint'){working.hint=true;renderTask();return}
 if(a==='option'){const choice=task.opts[Number(el.dataset.i)];logAndCheck(task,choice,task.answer);return}
 if(a==='token'){const i=Number(el.dataset.i);if(!working.tokens.includes(i))working.tokens.push(i);renderTask();return}
 if(a==='resetTokens'){working.tokens=[];renderTask();return}
 if(a==='checkOrder'){const list=task.kind==='sequence'?task.opts:task.tokens;const given=task.kind==='sequence'?working.tokens.map(i=>list[i]).join('|'):working.tokens.map(i=>list[i]).join(' ');const expected=task.kind==='sequence'?task.answer.join('|'):task.answer;logAndCheck(task,given,expected);return}
 if(a==='matchLeft'){working.left=el.dataset.v;working.feedback='Теперь выбери перевод справа.';working.feedbackType='';renderTask();return}
 if(a==='matchRight'){if(!working.left){working.feedback='Сначала выбери английское слово слева.';renderTask();return}const chosen=working.left,match=(task.pairs||[]).find(x=>x[0]===chosen),right=(task.pairs||[]).find(x=>x[0]===el.dataset.v);if(!match||!right||working.matched[chosen])return;record(task,chosen,match[0]===right[0],right[1],match[1]);if(match[0]===right[0]){working.matched[chosen]=true;learn(chosen);working.left=null;if(Object.keys(working.matched).length===task.pairs.length){finishTask(task);return}working.feedback='✓ Верная пара! Осталось '+(task.pairs.length-Object.keys(working.matched).length)+'.';working.feedbackType='good'}else{working.feedback='Не подходит. Попробуй другую пару.';working.feedbackType='bad'}renderTask();return}
}
function onSubmit(e){if(e.target.id!=='typeForm')return;e.preventDefault();const input=$('typedAnswer');const task=currentTask();if(!input||!task)return;logAndCheck(task,input.value,task.answer)}
function mkHomework(areaIndex){const wa=areas[areaIndex].words,ru=w=>words[w],id=(i)=>'hw2-'+areaIndex+'-'+i;
 return [
 {id:id(0),kind:'listen',word:wa[0],q:'🔊 Какое слово прозвучало? Выбери перевод.',opts:[ru(wa[1]),ru(wa[0]),ru(wa[2])],answer:ru(wa[0]),say:wa[0]},
 {id:id(1),kind:'pick',word:wa[2],q:'Как по-английски будет «'+ru(wa[2])+'»?',opts:[wa[3],wa[2],wa[4]],answer:wa[2],say:wa[2]},
 {id:id(2),kind:'type',word:wa[1],q:'Напиши по-английски: «'+ru(wa[1])+'».',opts:[],answer:wa[1],say:wa[1]},
 {id:id(3),kind:'match',word:wa[3],q:'Соедини три новых слова с переводом.',opts:[],say:wa[3],pairs:wa.slice(3,6).map(w=>[w,ru(w)])},
 {id:id(4),kind:'listen',word:wa[6],q:'🔊 Послушай и выбери значение.',opts:[ru(wa[6]),ru(wa[5]),ru(wa[7])],answer:ru(wa[6]),say:wa[6]},
 {id:id(5),kind:'type',word:wa[7],q:'Напиши по-английски: «'+ru(wa[7])+'».',opts:[],answer:wa[7],say:wa[7]}
 ] }
function hardWords(){let attempts=[...state.attempts];try{const one=JSON.parse(localStorage.getItem(FIRST));if(one?.attempts)attempts=attempts.concat(one.attempts)}catch{}
 const all=[...new Set(state.learned.concat(areas.slice(0,Math.max(1,Math.ceil(state.stage/12))).flatMap(a=>a.words)))].filter(w=>words[w]);
 return all.map(word=>{const ar=attempts.filter(x=>x.word===word),wrong=ar.filter(x=>!x.correct).length,hints=ar.filter(x=>x.hintUsed).length;return{word,score:wrong*5+hints*3+(ar.length===0?2:0)+(ar.length<2?1:0)}}).sort((a,b)=>b.score-a.score).slice(0,8).map(x=>x.word)}
function customReview(list,key){const chosen=[...new Set(list.map(x=>String(x).toUpperCase()))].filter(w=>words[w]).slice(0,12);
 const candidates=chosen.length?chosen:hardWords();const seen=areas.flatMap(x=>x.words);
 return candidates.map((word,i)=>{let opts=(i%2?seen:Object.keys(words)).filter(x=>x!==word);opts=[word,...opts.slice((i*3)%Math.max(1,opts.length),((i*3)%Math.max(1,opts.length))+3)];opts=[...new Set(opts)].slice(0,3);
 if(i%3===0)return{id:'review-'+key+'-'+i,kind:'listen',word,q:'Слушай слово и выбирай русский перевод.',opts:opts.map(w=>words[w]),answer:words[word],say:word};
 if(i%3===1)return{id:'review-'+key+'-'+i,kind:'type',word,q:'Напиши по-английски: «'+words[word]+'».',opts:[],answer:word,say:word};
 return{id:'review-'+key+'-'+i,kind:'pick',word,q:'Найди английское слово: «'+words[word]+'».',opts,answer:word,say:word}
 })}
function beginHomework(key){if(state.hwActive&&state.hwActive.key===key){mode=state.hwActive;working=null;success=null;render();return}
 let title='',items=[],area=null;
 if(key.startsWith('zone-')){area=Number(key.slice(5));if(state.stage<(area+1)*12){toast('Сначала пройди эту зону');return}title='Закрепление: '+areas[area].name;items=mkHomework(area)}
 else if(key==='final'){if(state.stage<48)return;title='Итоговый экзамен';items=customReview(areas.flatMap(a=>a.words).filter((w,i)=>i%3===0).slice(0,12),'final')}
 else if(key==='assigned'){if(!assigned?.words?.length)return;title=assigned.title||'От родителя';items=customReview(assigned.words,'assigned')}
 else {title='Персональное повторение';items=customReview(hardWords(),'personal')}
 if(!items.length){toast('Пока нет слов для тренировки');return}
 mode={key,title,items,index:0,correct:0,area};success=null;working=null;save();render();toast('Задание началось: '+items.length+' вопросов')}
async function sync(quiet){if(syncBusy)return;if(!window.EWCloud?.configured||!localStorage.getItem('ew-child-id')){if(!quiet)toast('Для синхронизации подключи игру кодом родителя');return}
 syncBusy=true;$('syncStatus').textContent='⏳ Отправляем ответы и задания…';
 try{await window.EWCloud.syncChapter2(state);assigned=await window.EWCloud.getAssignment();save();$('syncStatus').textContent='✅ Данные в кабинете · '+new Date().toLocaleTimeString('ru-RU');if(!quiet)toast('Результаты отправлены!');renderScene()}
 catch(e){$('syncStatus').textContent='⚠ Нет связи: '+String(e?.message||e).slice(0,115);if(!quiet)toast('Пока остаётся локальное сохранение — позже попробуем снова')}
 finally{syncBusy=false}}
async function connect(){const code=$('pairCode').value.trim();if(!code){toast('Введи код из родительского кабинета');return}
 try{await window.EWCloud.connectStudent(code);$('syncStatus').textContent='Подключено. Переносим предыдущие ответы…';await sync(false);toast('Связь с кабинетом родителя установлена')}catch(e){toast('Ошибка кода: '+String(e?.message||e).slice(0,120))}}
async function startCloud(){if(!window.EWCloud?.configured){$('syncStatus').textContent='☁️ Облачная база не настроена';return}if(!localStorage.getItem('ew-child-id')){$('syncStatus').textContent='🔑 Нужно один раз ввести код из родительского кабинета.';return}
 try{const remote=await window.EWCloud.getChapter2State();if(remote&&Number(remote.stage||0)>state.stage){const local=state;state={...fresh(),...remote,attempts:local.attempts,homeworkHistory:remote.homeworkHistory||local.homeworkHistory};mode=state.hwActive||null;render();toast('Прогресс главы 2 восстановлен из облака')}
 await sync(true)}catch(e){$('syncStatus').textContent='⚠ Не удалось прочитать облачный прогресс: '+String(e?.message||e).slice(0,100)}}
$('taskBox').addEventListener('click',onAction);$('taskBox').addEventListener('submit',onSubmit);
$('syncBtn').onclick=()=>sync(false);$('pairBtn').onclick=connect;
render();startCloud();
window.addEventListener('online',()=>scheduleSync());
})();