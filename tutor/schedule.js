/* Four-week English Tutor calendar: Monday–Thursday new topic, Friday cumulative revision, weekends free.
   Anchor: 16 November 2026, local calendar dates. No cloud or personal data. */
(() => {
 "use strict";
 const ANCHOR="2026-11-16", WEEK_COUNT=4;
 const toDate=iso=>new Date(iso+"T12:00:00Z");
 const shift=(iso,n)=>{const d=toDate(iso);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
 const between=(a,b)=>Math.round((toDate(a).getTime()-toDate(b).getTime())/86400000);
 const all=()=>window.TUTOR_LESSONS||[];
 function buildReview(week){
   const source=all().slice(week*4,week*4+4);
   if(source.length<4)return null;
   const unique=new Set(),collected=[];
   for(const item of source){let taken=0;for(const pair of item.words){if(unique.has(pair[0]))continue;unique.add(pair[0]);collected.push(pair);if(++taken===4)break}}
   return {
     id:"review-week-"+(week+1),
     title:"Большое повторение · неделя "+(week+1),
     level:"Повторение",topic:"Проверка четырёх уроков: чтение, понимание, грамматика и слова",
     words:collected,
     text:source.map((l,i)=>"Урок "+(week*4+i+1)+" — "+l.title+"\n"+l.text).join("\n\n"),
     questions:source.flatMap(l=>l.questions.slice(0,2).map(q=>[l.title+": "+q[0],q[1],q[2]])),
     grammar:source.flatMap(l=>l.grammar.slice(0,2).map(q=>[l.title+": "+q[0],q[1],q[2]])),
     parts:source.map(l=>({title:l.title,id:l.id,text:l.text})),
     isReview:true,minimumSeconds:2700,
     weekNumber:week+1
   };
 }
 function plan(iso,overrides={}){
   const delta=between(iso,ANCHOR);
   if(delta<0)return {date:iso,status:"before",title:"Курс начинается 16 ноября 2026"};
   if(delta>=WEEK_COUNT*7)return {date:iso,status:"finished",title:"Четырёхнедельный курс завершён"};
   const week=Math.floor(delta/7),weekday=delta%7;
   if(weekday===5||weekday===6)return {date:iso,status:"rest",week:week+1,weekday,title:"Выходной — отдых от английского"};
   if(weekday===4){
     const lesson=buildReview(week);
     return lesson?{date:iso,status:"lesson",isReview:true,week:week+1,weekday,lesson,minutes:45}: {date:iso,status:"finished",title:"Недостаточно уроков для повторения"};
   }
   const index=week*4+weekday;
   const defaultLesson=all()[index];
   const chosen=all().find(x=>x.id===overrides?.[iso])||defaultLesson;
   if(!chosen)return {date:iso,status:"finished",title:"Нужны новые учебные материалы"};
   return {date:iso,status:"lesson",isReview:false,week:week+1,weekday,lesson:chosen,minutes:30};
 }
 function board(overrides={}){
   return Array.from({length:WEEK_COUNT},(_,week)=>({
    week:week+1,
    dates:Array.from({length:7},(_,day)=>plan(shift(ANCHOR,week*7+day),overrides))
   }));
 }
 window.ENGLISH_TUTOR_PLAN={ANCHOR,WEEK_COUNT,plan,board,shift};
})();