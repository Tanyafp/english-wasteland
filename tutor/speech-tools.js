(() => {
"use strict";
/* Pronunciation coach: word recordings when available, adjustable TTS and
   sentence-by-sentence speech recognition. Recognition is NOT phonetic grading. */
const SETTINGS_KEY="english-tutor-speech-v1";
let prefs={voice:"",rate:0.85};
try{prefs={...prefs,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}")}}catch{}
let activeAudio=null,activeRecognition=null,soundSerial=0;
const cache=new Map();
const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const tokens=s=>String(s||"").match(/[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*/g)||[];
const canonical=s=>String(s||"").toLowerCase().replace(/['’\-]/g,"").trim();
function sentences(text){
 return String(text||"").split(/\n+/).map(x=>x.trim()).filter(x=>x&&!/^Урок\s+\d+\s*[—–-]/i.test(x))
   .flatMap(x=>(x.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[]).map(v=>v.trim()).filter(Boolean));
}
function align(expected,heard){
 const a=tokens(expected),b=tokens(heard),n=a.length,m=b.length;
 const d=Array.from({length:n+1},()=>Array(m+1).fill(0));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)
  d[i][j]=canonical(a[i])===canonical(b[j])?1+d[i+1][j+1]:Math.max(d[i+1][j],d[i][j+1]);
 const hits=[];let i=0,j=0;
 while(i<n&&j<m){
  if(canonical(a[i])===canonical(b[j])){hits.push(i);i++;j++}
  else if(d[i+1][j]>=d[i][j+1])i++;else j++;
 }
 return {words:a,hits,percent:n?Math.round(hits.length*100/n):0};
}
function voices(){
 if(!("speechSynthesis" in window))return [];
 return speechSynthesis.getVoices().filter(v=>/^en[-_]/i.test(v.lang)).sort((a,b)=>rank(b)-rank(a));
}
function rank(v){
 const n=v.name.toLowerCase();
 return (/natural|neural|online/.test(n)?100:0)+(/google us english/.test(n)?75:0)
  +(/microsoft/.test(n)?30:0)+(/samantha/.test(n)?25:0)+(/en-us/i.test(v.lang)?6:0);
}
function chosenVoice(){
 const all=voices();
 return all.find(v=>v.voiceURI===prefs.voice||v.name===prefs.voice)||all[0]||null;
}
function persist(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(prefs))}catch{}}
function stopOutput(){
 if(activeAudio){try{activeAudio.pause();activeAudio.currentTime=0}catch{}activeAudio=null}
 if("speechSynthesis" in window)try{speechSynthesis.cancel()}catch{}
}
function synth(text,slow=false){
 if(!("speechSynthesis" in window)){return false}
 const utterance=new SpeechSynthesisUtterance(text);
 const voice=chosenVoice();if(voice){utterance.voice=voice;utterance.lang=voice.lang}else utterance.lang="en-US";
 utterance.rate=Math.max(0.65,Math.min(1.15,Number(prefs.rate)||0.85))*(slow?0.85:1);
 utterance.pitch=1;utterance.volume=1;
 speechSynthesis.speak(utterance);
 return true;
}
async function recorded(word){
 const key=word.toLowerCase();
 if(cache.has(key))return cache.get(key);
 try{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),4500);
  let entries;
  try{
   const r=await fetch("https://api.dictionaryapi.dev/api/v2/entries/en/"+encodeURIComponent(key),{signal:controller.signal});
   if(!r.ok)throw Error("No dictionary recording");
   entries=await r.json();
  }finally{clearTimeout(timeout)}
  const list=Array.isArray(entries)?entries:[];
  const urls=list.flatMap(e=>e.phonetics||[]).map(p=>p.audio)
   .filter(u=>typeof u==="string"&&(u.startsWith("https://")||u.startsWith("//")))
   .map(u=>u.startsWith("//")?"https:"+u:u);
  const url=urls.find(u=>/-us\.mp3|_us_|us\.mp3/i.test(u))||urls[0]||"";
  cache.set(key,url);return url;
 }catch{cache.set(key,"");return ""}
}
async function sayWord(word){
 const key=String(word||"").trim();if(!key)return;
 const id=++soundSerial;stopOutput();
 const isSingle=/^[A-Za-z]+(?:['’\-][A-Za-z]+)*$/.test(key);
 const url=isSingle?await recorded(key):"";
 if(soundSerial!==id)return;
 if(url){
  const audio=new Audio(url);activeAudio=audio;
  try{await audio.play();return}catch{if(activeAudio===audio)activeAudio=null}
 }
 if(soundSerial===id)synth(key,true);
}
function saySentence(text,slow=false){++soundSerial;stopOutput();synth(text,slow)}
function stopReading(){
 if(activeRecognition){const r=activeRecognition;activeRecognition=null;try{r.abort()}catch{}}
}
function cancel(){++soundSerial;stopOutput();stopReading()}
function renderVoiceSettings(){
 return '<div class="tutor-voice-settings"><label>🎧 Английский голос <select class="tutor-voice-select" aria-label="Выбор английского голоса"><option value="">Автоматически</option></select></label>'+
  '<label>Скорость <select class="tutor-speed-select" aria-label="Скорость произношения"><option value="0.75">Медленно</option><option value="0.85">Удобно (0,85×)</option><option value="1">Обычно</option></select></label>'+
  '<button type="button" class="tutor-voice-demo">🔊 Послушать голос</button></div>';
}
function populateVoiceSelect(sel){
 if(!sel)return;
 const all=voices();
 const options='<option value="">Лучший доступный голос'+(!all.length?" (голоса загружаются)":"")+'</option>'+
  all.map(v=>'<option value="'+escapeHtml(v.voiceURI)+'">'+escapeHtml(v.name+" · "+v.lang)+'</option>').join("");
 sel.innerHTML=options;
 sel.value=all.some(v=>v.voiceURI===prefs.voice)?prefs.voice:"";
}
function bindVoiceSettings(root){
 if(!root)return;
 root.querySelectorAll(".tutor-voice-select").forEach(el=>{
  populateVoiceSelect(el);
  el.onchange=()=>{prefs.voice=el.value;persist()};
 });
 root.querySelectorAll(".tutor-speed-select").forEach(el=>{
  el.value=String(prefs.rate);
  el.onchange=()=>{prefs.rate=Number(el.value);persist()};
 });
 root.querySelectorAll(".tutor-voice-demo").forEach(el=>el.onclick=()=>saySentence("Hello! Let's learn English together."));
}
if("speechSynthesis" in window){
 speechSynthesis.addEventListener("voiceschanged",()=>{
  document.querySelectorAll(".tutor-voice-select").forEach(populateVoiceSelect);
 });
}
function wordMarkup(sentence,result){
 const a=tokens(sentence),hits=new Set(result?.hits||[]);
 if(result?.manual)result=null;
 return a.map((word,i)=>{
  const klass=!result?"":hits.has(i)?"heard":"unheard";
  const aria=!result?"Прослушать слово ":hits.has(i)?"Распознано, прослушать ":"Не распознано, прослушать ";
  return '<button type="button" class="tutor-read-word '+klass+'" data-pronounce="'+escapeHtml(word)+'" aria-label="'+aria+escapeHtml(word)+'">'+escapeHtml(word)+'<span aria-hidden="true"> 🔊</span></button>';
 }).join(" ");
}
function renderReading(args){
 const {root,lesson,session,save,record,refresh,goNext,onAction}=args;
 if(!root)return;
 const lines=sentences(lesson.text);if(!lines.length)return;
 if(!session.readSentences||typeof session.readSentences!=="object")session.readSentences={};
 const entries=session.readSentences;
 let index=Math.min(Math.max(0,Number(session.readCursor)||0),lines.length-1);
 session.readCursor=index;
 const report=entries[index],passed=lines.filter((_,i)=>entries[i]?.passed).length;
 const legacy=session.spoken&&passed===0;
 root.innerHTML='<div class="eyebrow">Чтение по предложениям · '+passed+'/'+lines.length+'</div>'+
  '<p>Сначала послушай английскую фразу в наушниках, потом прочитай её в микрофон. Зелёное — распознано, красноватое — стоит повторить. Нажми на любое слово, чтобы услышать его отдельно.</p>'+
  renderVoiceSettings()+
  '<div class="tutor-sentence-nav"><button type="button" id="sentencePrev" '+(index===0?"disabled":"")+'>← Предыдущее</button><strong>Предложение '+(index+1)+' из '+lines.length+'</strong><button type="button" id="sentenceNext" '+(index===lines.length-1?"disabled":"")+'>Следующее →</button></div>'+
  '<div class="tutor-sentence" id="sentenceWords">'+wordMarkup(lines[index],report)+'</div>'+
  '<div class="tutor-read-actions"><button type="button" id="sentenceListen">🔊 Послушать фразу</button><button type="button" id="sentenceSlow">🐢 Медленнее</button><button type="button" class="primary" id="sentenceRecord">🎤 Прочитать в микрофон</button><button type="button" id="sentenceStop" disabled>■ Остановить</button></div>'+
  '<div class="tutor-read-feedback" id="sentenceFeedback" aria-live="polite">'+
  (report?(report.manual?'<p>✓ Отмечено вручную: произношение не оценивалось.</p>':'<p><strong>Распознано '+report.percent+'% слов.</strong> '+(report.passed?'Отлично, можно дальше.':'Повтори выделенные слова и попробуй ещё раз.')+'</p><p class="small muted">Браузер услышал: «'+escapeHtml(report.transcript||"")+'».</p>'):
  '<p>Когда прочитаешь предложение, подсветим слова, которые удалось распознать. Проверка приблизительная: даже правильная речь иногда распознаётся неверно.</p>')+
  '</div>'+
  '<details class="tutor-read-manual"><summary>Не работает микрофон?</summary><p class="small muted">Можно прослушать фразу и отметить прочтение вручную — без проверки слов.</p><button type="button" id="sentenceManual">Я прочитал это предложение вслух</button></details>'+
  '<div class="tutor-sentence-pills">'+lines.map((_,i)=>'<button type="button" data-sentence-index="'+i+'" class="'+(i===index?"active ":"")+(entries[i]?.passed?"done":"")+'" aria-label="Предложение '+(i+1)+'">'+(i+1)+(entries[i]?.passed?" ✓":"")+'</button>').join("")+'</div>'+
  (session.spoken?'<div class="notice success">'+(legacy?'Чтение было зачтено в предыдущей версии. Теперь можно потренироваться по фразам.':'Все предложения прочитаны! Можно перейти к вопросам.')+'</div>':
  '<div class="notice">Для завершения раздела прочитай все предложения. Если распознавание ошибается, можно повторить запись или отметить прочтение вручную.</div>')+
  '<button type="button" class="primary" id="sentenceContinue" '+(session.spoken?"":"disabled")+'>К вопросам по тексту →</button>';
 bindVoiceSettings(root);
 root.querySelectorAll("[data-pronounce]").forEach(b=>b.onclick=()=>{onAction();sayWord(b.dataset.pronounce)});
 root.querySelectorAll("[data-sentence-index]").forEach(b=>b.onclick=()=>jump(Number(b.dataset.sentenceIndex)));
 root.querySelector("#sentencePrev").onclick=()=>jump(index-1);
 root.querySelector("#sentenceNext").onclick=()=>jump(index+1);
 root.querySelector("#sentenceListen").onclick=()=>{onAction();saySentence(lines[index])};
 root.querySelector("#sentenceSlow").onclick=()=>{onAction();saySentence(lines[index],true)};
 root.querySelector("#sentenceContinue").onclick=()=>{cancel();goNext()};
 root.querySelector("#sentenceManual").onclick=()=>{
  onAction();cancel();entries[index]={manual:true,passed:true,percent:null,hits:[],transcript:""};
  finishIfReady();save();refresh();
 };
 const recBtn=root.querySelector("#sentenceRecord"),stopBtn=root.querySelector("#sentenceStop");
 recBtn.onclick=()=>{
  const Engine=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Engine){
   root.querySelector("#sentenceFeedback").textContent="Распознавание недоступно в этом браузере. Попробуй Chrome или используй ручную отметку.";
   return;
  }
  onAction();cancel();
  let text="",error="";
  let rec;
  try{
   rec=new Engine();activeRecognition=rec;rec.lang=chosenVoice()?.lang||"en-US";
   rec.continuous=false;rec.interimResults=false;rec.maxAlternatives=1;
   recBtn.disabled=true;stopBtn.disabled=false;
   root.querySelector("#sentenceFeedback").textContent="Слушаю! Прочитай только выделенное предложение, затем нажми «Остановить».";
   rec.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)text+=" "+e.results[i][0].transcript};
   rec.onerror=e=>{error=e.error||"Ошибка микрофона"};
   rec.onend=()=>{
    if(activeRecognition!==rec)return;activeRecognition=null;
    if(session.stage!=="reading")return;
    if(!text.trim()){
     recBtn.disabled=false;stopBtn.disabled=true;
     root.querySelector("#sentenceFeedback").textContent=error?"Микрофон: "+error+". Проверь разрешение и повтори.":"Речь не распознана. Попробуй ещё раз.";
     return;
    }
    const score=align(lines[index],text);
    entries[index]={transcript:text.trim(),hits:score.hits,percent:score.percent,passed:score.percent>=65,manual:false};
    record("чтение по предложениям",lines[index],text.trim(),lines[index],score.percent>=65);
    finishIfReady();save();refresh();
   };
   rec.start();
   stopBtn.onclick=()=>{if(activeRecognition===rec)rec.stop()};
  }catch(e){
   activeRecognition=null;recBtn.disabled=false;stopBtn.disabled=true;
   root.querySelector("#sentenceFeedback").textContent="Не удалось запустить микрофон: "+e.message;
  }
 };
 function jump(next){
  if(next<0||next>=lines.length)return;
  onAction();cancel();session.readCursor=next;save();refresh();
 }
 function finishIfReady(){
  if(lines.every((_,i)=>entries[i]?.passed)){
   session.spoken=true;session.spokenMode="sentence-by-sentence";
   const scores=lines.map((_,i)=>entries[i]).filter(e=>e&&!e.manual&&typeof e.percent==="number").map(e=>e.percent);
   session.readCoverage=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):null;
  }
 }
}
window.TUTOR_SPEECH={renderReading,renderVoiceSettings,bindVoiceSettings,sayWord,cancel,align,sentences};
})();