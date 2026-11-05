/* English Wasteland, Chapter 2 — structured learning content. */
(()=>{
'use strict';
const words={
HELLO:'привет',ROBOT:'робот',KEY:'ключ',TAKE:'взять',DOOR:'дверь',OPEN:'открыть',WATER:'вода',YES:'да',NO:'нет',GO:'идти',THE:'артикль',
HELP:'помощь / помоги',FIND:'найти',BOX:'коробка',RED:'красный',BLUE:'синий',GREEN:'зелёный',BAG:'сумка',FOOD:'еда',
LIGHT:'свет',DARK:'темно',ON:'включено',OFF:'выключено',BUTTON:'кнопка',PRESS:'нажать',STOP:'остановиться',START:'начать',
LISTEN:'слушать',SPEAK:'говорить',NAME:'имя',FRIEND:'друг',WHERE:'где',HERE:'здесь',COME:'подойти',WAIT:'подождать',
LEFT:'налево',RIGHT:'направо',MAP:'карта',EXIT:'выход',SAFE:'безопасно',DANGER:'опасность',WALK:'идти пешком',RUN:'бежать'
};
const areas=[
 {id:'medbay',name:'Медотсек',icon:'🧰',subtitle:'Пропал аварийный набор',intro:'БОТ-7 получил сообщение о потерянных припасах. Разберись в голосовых командах и найди правильную коробку.',words:['HELP','FIND','BOX','RED','BLUE','GREEN','BAG','FOOD'],reward:'🧰 Набор медика'},
 {id:'power',name:'Энергоблок',icon:'⚡',subtitle:'Погас свет',intro:'В коридорах темно. Терминал просит восстановить питание. Кнопки подписаны по-английски.',words:['LIGHT','DARK','ON','OFF','BUTTON','PRESS','STOP','START'],reward:'🔋 Аккумулятор'},
 {id:'radio',name:'Радиостанция',icon:'📡',subtitle:'Сигнал из пустоши',intro:'Кто-то выходит на связь! Отвечай на простые вопросы, слушай эфир и помоги найти друга.',words:['LISTEN','SPEAK','NAME','FRIEND','WHERE','HERE','COME','WAIT'],reward:'📻 Радиомодуль'},
 {id:'exit',name:'Выход на поверхность',icon:'🧭',subtitle:'Маршрут через развилку',intro:'Сканер построил карту безопасного прохода. Выбирай направление и собирай команды.',words:['LEFT','RIGHT','MAP','EXIT','SAFE','DANGER','WALK','RUN'],reward:'🗺️ Карта маршрута'}
];
const tasks=[];
const add=(kind,word,q,opts,answer,say,extra={})=>{tasks.push({id:'c2-'+String(tasks.length+1).padStart(2,'0'),area:Math.floor(tasks.length/12),kind,word,q,opts,answer,say,...extra});};
const m=(pairs,q)=>add('match',pairs[0][0],q,[],null,pairs.map(x=>x[0]).join(', '),{pairs});
const o=(word,q,sentence,tokens)=>add('order',word,q,[],sentence,sentence,{tokens});
const s=(word,q,opts,answer,say)=>add('listen',word,q,opts,answer,say);
const p=(word,q,opts,answer,say)=>add('pick',word,q,opts,answer,say);
const v=(word,q,opts,answer,say)=>add('visual',word,q,opts,answer,say);
const d=(word,q,opts,answer,say)=>add('dialogue',word,q,opts,answer,say);
const t=(word,q,answer,say)=>add('type',word,q,[],answer,say);
const z=(word,q,options,answer)=>add('sequence',word,q,options,answer,answer.join('. '));
// MEDBAY 1–12
d('HELP','Робот просит помощи: «Help me!». Что ответить?',['YES','KEY','NO'], 'YES','Help me!');
s('FIND','🔊 Послушай приказ. Что нужно сделать?',['Найти коробку','Закрыть дверь','Взять воду'],'Найти коробку','Find the box');
v('RED','Система просит RED BOX. Нажми нужную коробку.',['🔵 Синяя','🔴 Красная','🟢 Зелёная'],'🔴 Красная','Red box');
m([['RED','красный'],['BLUE','синий'],['GREEN','зелёный']],'Соедини цветные слова с русским переводом.');
p('BOX','Что такое BOX?',['Сумка','Коробка','Вода','Ключ'],'Коробка','Box');
t('HELP','Напечатай по-английски «помоги».','HELP','Help');
o('TAKE','Собери команду: «Возьми синюю коробку».','TAKE THE BLUE BOX',['BOX','BLUE','TAKE','THE']);
s('FOOD','🔊 Что лежит в контейнере?',['Еда','Свет','Карта'],'Еда','Food');
d('WATER','БОТ-7 спрашивает: «Do you have water?». У тебя есть вода.',['NO','YES','STOP'],'YES','Do you have water?');
v('BAG','Куда сложить находки? FIND THE BAG.',['📦 Коробка','🎒 Сумка','💧 Вода'],'🎒 Сумка','Find the bag');
t('FIND','Напечатай слово «найти».','FIND','Find');
o('FOOD','Последняя команда медотсека: «Возьми еду».','TAKE THE FOOD',['FOOD','THE','TAKE']);
// POWER 13–24
s('LIGHT','🔊 Какую вещь просит включить терминал?',['Свет','Воду','Сумку'],'Свет','Light');
v('DARK','Где DARK — темно?',['☀️ Светлый коридор','🌑 Тёмный коридор','💡 Лампа'],'🌑 Тёмный коридор','Dark');
m([['ON','включено'],['OFF','выключено'],['BUTTON','кнопка']],'Подбери значения надписей на панели.');
d('PRESS','На экране: «Press the button». Что сделать?',['Нажать кнопку','Выйти наружу','Подождать'],'Нажать кнопку','Press the button');
t('PRESS','Напечатай команду «нажать».','PRESS','Press');
o('ON','Собери команду: «Включи свет».','LIGHT ON',['ON','LIGHT']);
p('STOP','Система перегрелась. Какая команда остановит её?',['START','STOP','GO'],'STOP','Stop');
s('START','🔊 Какая команда прозвучала?',['Начать','Остановиться','Открыть'],'Начать','Start');
o('BUTTON','Запусти питание: «Нажми зелёную кнопку».','PRESS THE GREEN BUTTON',['GREEN','BUTTON','PRESS','THE']);
t('OFF','Как написать «выключено»?','OFF','Off');
m([['LIGHT','свет'],['DARK','темно'],['START','начать']],'Сопоставь слова из энергоблока.');
d('ON','Индикатор горит. Робот спрашивает: «Is the light on?».',['YES','NO','WAIT'],'YES','Is the light on?');
// RADIO 25–36
s('LISTEN','🔊 Какую команду ты услышал?',['Слушай','Иди','Беги'],'Слушай','Listen');
d('NAME','Из динамика: «What is your name?». Что у тебя спрашивают?',['Где ты?','Как тебя зовут?','Где выход?'],'Как тебя зовут?','What is your name?');
p('FRIEND','Кто такой FRIEND?',['Враг','Друг','Робот'],'Друг','Friend');
m([['WHERE','где'],['HERE','здесь'],['WAIT','подожди']],'Восстанови слова из повреждённого радиосообщения.');
t('SPEAK','Напиши «говорить» по-английски.','SPEAK','Speak');
o('LISTEN','Собери команду: «Слушай робота».','LISTEN TO THE ROBOT',['ROBOT','THE','LISTEN','TO']);
d('HERE','Друг спрашивает: «Where are you?». Ты здесь!',['I AM HERE','I AM LOST','NO'],'I AM HERE','Where are you?');
s('COME','🔊 Что тебе предложили?',['Подойди сюда','Иди налево','Подожди здесь'],'Подойди сюда','Come here');
v('LISTEN','Какое действие значит LISTEN?',['👂 Слушать','🗣️ Говорить','🏃 Бежать'],'👂 Слушать','Listen');
t('NAME','Напечатай слово «имя».','NAME','Name');
o('WAIT','Передай по радио: «Подожди здесь».','WAIT HERE',['HERE','WAIT']);
d('FRIEND','«Are you my friend?» — робот хочет знать, друг ли ты.',['YES','EXIT','RED'],'YES','Are you my friend?');
// EXIT 37–48
p('MAP','Что поможет выбрать маршрут?',['MAP','FOOD','BUTTON'],'MAP','Map');
s('LEFT','🔊 В какую сторону двигаться?',['Налево','Направо','Назад'],'Налево','Go left');
v('RIGHT','Робот говорит RIGHT. Выбери стрелку.',['⬅️ Налево','➡️ Направо','⬆️ Прямо'],'➡️ Направо','Right');
m([['LEFT','налево'],['RIGHT','направо'],['EXIT','выход']],'Собери подсказки для маршрута.');
t('SAFE','Напиши слово «безопасно».','SAFE','Safe');
o('WALK','Собери команду: «Иди к выходу».','WALK TO THE EXIT',['THE','EXIT','WALK','TO']);
d('SAFE','Робот показывает безопасный путь и спрашивает: «Is it safe?»',['YES','NO','STOP'],'YES','Is it safe?');
s('RUN','🔊 Какая команда прозвучала?',['Беги','Иди','Открой'],'Беги','Run');
v('DANGER','На какой табличке предупреждение об опасности?',['⚠️ DANGER','✅ SAFE','🗺️ MAP'],'⚠️ DANGER','Danger');
t('RIGHT','Напечатай «направо».','RIGHT','Right');
o('GO','Собери короткую команду: «Иди направо».','GO RIGHT',['RIGHT','GO']);
z('EXIT','Финал: выбери последовательность команд. Сначала открой дверь, затем налево и к выходу.',
 ['WALK TO THE EXIT','OPEN THE DOOR','GO LEFT'],['OPEN THE DOOR','GO LEFT','WALK TO THE EXIT']);
if(tasks.length!==48 || areas.reduce((n,a)=>n+a.words.length,0)!==32)throw Error('Invalid chapter content');
window.EW2_DATA={words,areas,tasks};
})();