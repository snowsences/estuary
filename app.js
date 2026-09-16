const key='cream-corn-v1', monthLabels=['January','February','March','April','May','June','July','August','September','October','November','December'], round=n=>Math.round((Number(n)||0)*100)/100, maskDigits=value=>String(value).replace(/\d/g,'9'), num=x=>Number.isFinite(Number(x))?round(x):0;let displayMode=localStorage.getItem('cream-corn-display-mode')==='on',historyFilter='',money=n=>{const value=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(round(n));return displayMode?maskDigits(value):value};
const investmentAccountTypes=['IRA','401k','Brokerage','Savings'];
const defaultInvestmentAccounts=[{id:'ira',name:'IRA',type:'IRA',annualGoal:0,currentTotal:0,archived:false},{id:'401k-1',name:'401(k) 1',type:'401k',yearlyContribution:0,currentTotal:0,archived:false},{id:'401k-2',name:'401(k) 2',type:'401k',yearlyContribution:0,currentTotal:0,archived:false},{id:'brokerage',name:'Brokerage · VOO',type:'Brokerage',annualGoal:0,currentTotal:0,archived:false}];
const starter={months:[['2026-01','January 2026'],['2026-02','February 2026'],['2026-03','March 2026'],['2026-04','April 2026']].map(([id,label])=>({id,label,water:0,electricity:0,gas:0,groceries:0,spending:0,cashOffset:0,notes:''})),entries:[],extraIncome:[],investments:[],investmentBalances:[],accounts:[],settings:{monthlyIncome:7800,fixedExpenses:489,kevinMortgage:1250,foodShare:50,meganR1:0,meganR2:0,investmentAccounts:defaultInvestmentAccounts.map(account=>({...account}))},dropbox:{appKey:'',filePath:'/Budget.xlsx',accessToken:'',name:'',revision:'',rowMap:{}}};
const safeText=(value,maxLength)=>String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,' ').slice(0,maxLength),monthIdPattern=/^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/,safeMonthId=value=>monthIdPattern.test(String(value||''))?String(value):'',safeId=(value,prefix='item')=>{const id=String(value||'');return /^[A-Za-z0-9_-]{1,128}$/.test(id)?id:`${prefix}-${crypto.randomUUID()}`},safeDateTime=value=>{const text=String(value||'');return text.length<=40&&Number.isFinite(Date.parse(text))?new Date(text).toISOString():new Date().toISOString()},safeNumber=(value,min=-10000000,max=10000000)=>Math.max(min,Math.min(max,num(value)));
const safeDateId=value=>{const text=String(value||'');if(!/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(text))return'';const parsed=new Date(`${text}T12:00:00Z`);return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===text?text:''};
function normalizeMonthRecord(value,fallbackId=''){if(!value||typeof value!=='object'||Array.isArray(value))return null;const id=safeMonthId(value.id)||safeMonthId(fallbackId);if(!id)return null;const monthIndex=Number(id.slice(5,7))-1;return{id,label:`${monthLabels[monthIndex]} ${id.slice(0,4)}`,water:safeNumber(value.water),electricity:safeNumber(value.electricity),gas:safeNumber(value.gas),groceries:safeNumber(value.groceries),spending:safeNumber(value.spending),cashOffset:safeNumber(value.cashOffset),notes:safeText(value.notes,500)}}
function normalizeExpenseRecord(value,fallbackId=''){if(!value||typeof value!=='object'||Array.isArray(value))return null;const month=safeMonthId(value.month),types=['Spending','Water','Electricity','Gas','Groceries'];if(!month||!types.includes(value.type))return null;const legacyDining=value.category==='Restaurants'||value.category==='Shopping'&&value.subcategory==='Dining',category=legacyDining?'Dining':value.category,categories=['Groceries','Dining','Shopping'],subcategories=['','Entertainment','Travel','Health','Pets','Misc'];const entry={id:safeId(value.id||fallbackId,'expense'),type:value.type,month,original:safeNumber(value.original,0),modifier:safeNumber(value.modifier,.9,1),final:safeNumber(value.final,0),comment:safeText(value.comment,500),createdAt:safeDateTime(value.createdAt)};if(categories.includes(category))entry.category=category;if(legacyDining)entry.subcategory='';else if(subcategories.includes(value.subcategory))entry.subcategory=value.subcategory;if(value.updatedAt)entry.updatedAt=safeDateTime(value.updatedAt);return entry}
function normalizeExtraIncomeRecord(value,fallbackId=''){if(!value||typeof value!=='object'||Array.isArray(value))return null;const month=safeMonthId(value.month),categories=['Signup Bonus','Gift','Misc'];if(!month||!categories.includes(value.category))return null;const entry={id:safeId(value.id||fallbackId,'income'),month,amount:safeNumber(value.amount,0),category:value.category,description:safeText(value.description,300),createdAt:safeDateTime(value.createdAt)};if(value.updatedAt)entry.updatedAt=safeDateTime(value.updatedAt);return entry.amount>0?entry:null}
function normalizeInvestmentRecord(value,fallbackId=''){if(!value||typeof value!=='object'||Array.isArray(value))return null;const date=safeDateId(value.date),accountId=/^[A-Za-z0-9_-]{1,128}$/.test(String(value.accountId||''))?String(value.accountId):'';if(!date||!accountId||value.contributionType!=='Your contribution')return null;const entry={id:safeId(value.id||fallbackId,'investment'),accountId,date,amount:safeNumber(value.amount,0),contributionType:'Your contribution',description:safeText(value.description,300),createdAt:safeDateTime(value.createdAt)};if(value.updatedAt)entry.updatedAt=safeDateTime(value.updatedAt);return entry.amount>0?entry:null}
function normalizeInvestmentBalanceRecord(value,fallbackId=''){if(!value||typeof value!=='object'||Array.isArray(value))return null;const date=safeDateId(value.date),accountId=/^[A-Za-z0-9_-]{1,128}$/.test(String(value.accountId||''))?String(value.accountId):'',hasTotal=value.total!==undefined&&value.total!==null&&value.total!=='';if(!date||!accountId||!hasTotal)return null;const entry={id:safeId(value.id||fallbackId||`${accountId}-${date}`,'balance'),accountId,date,total:safeNumber(value.total,0),createdAt:safeDateTime(value.createdAt)};if(value.updatedAt)entry.updatedAt=safeDateTime(value.updatedAt);return entry}
function sanitizeAccountSvgMarkup(value){const text=String(value||'').trim();if(!text||new TextEncoder().encode(text).length>100000)return'';const documentNode=new DOMParser().parseFromString(text,'image/svg+xml'),root=documentNode.documentElement;if(root.localName!=='svg'||documentNode.querySelector('parsererror'))return'';const allowed=new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','defs','linearGradient','radialGradient','stop','clipPath','mask','filter','feGaussianBlur','feOffset','feBlend','feColorMatrix','feFlood','feComposite','title','desc']);[...root.querySelectorAll('*')].forEach(element=>{if(!allowed.has(element.localName)){element.remove();return}[...element.attributes].forEach(attribute=>{const name=attribute.name.toLowerCase(),content=attribute.value.toLowerCase(),unsafeUrl=/url\((?!\s*['"]?#)/i.test(attribute.value);if(name.startsWith('on')||name==='href'||name==='xlink:href'||content.includes('javascript:')||content.includes('@import')||content.includes('expression(')||unsafeUrl)element.removeAttribute(attribute.name)})});[...root.attributes].forEach(attribute=>{const name=attribute.name.toLowerCase(),content=attribute.value.toLowerCase();if(name.startsWith('on')||name==='href'||name==='xlink:href'||content.includes('javascript:')||content.includes('@import')||content.includes('expression(')||/url\((?!\s*['"]?#)/i.test(attribute.value))root.removeAttribute(attribute.name)});root.setAttribute('xmlns','http://www.w3.org/2000/svg');const cleaned=new XMLSerializer().serializeToString(root);return new TextEncoder().encode(cleaned).length<=100000?cleaned:''}
function normalizeAccountRecord(value,fallbackId=''){if(!value||typeof value!=='object'||Array.isArray(value))return null;const kinds=['Credit Card','Bank Account'],statuses=['Active','Closed'],name=safeText(value.name,80).trim();if(!name||!kinds.includes(value.kind))return null;const record={id:safeId(value.id||fallbackId,'account'),kind:value.kind,name,use:safeText(value.use,500).trim(),signupBonus:safeText(value.signupBonus,1000).trim(),status:statuses.includes(value.status)?value.status:'Active',imageSvg:sanitizeAccountSvgMarkup(value.imageSvg),createdAt:safeDateTime(value.createdAt)};if(value.updatedAt)record.updatedAt=safeDateTime(value.updatedAt);return record}
function normalizeInvestmentAccount(value,fallback={}){if(!value||typeof value!=='object'||Array.isArray(value))return null;const id=safeId(value.id||fallback.id,'investment-account'),name=safeText(value.name||fallback.name||'Investment account',60).trim(),inferred=String(value.id||value.name||'').toLowerCase().includes('401')?'401k':String(value.id||value.name||'').toLowerCase().includes('broker')||String(value.name||'').toLowerCase().includes('voo')?'Brokerage':String(value.id||value.name||'').toLowerCase().includes('saving')?'Savings':'IRA',type=investmentAccountTypes.includes(value.type)?value.type:inferred;if(!name)return null;return{id,name,type,annualGoal:type==='IRA'||type==='Brokerage'?safeNumber(value.annualGoal??fallback.annualGoal,0):0,yearlyContribution:type==='401k'?safeNumber(value.yearlyContribution??value.annualGoal??fallback.yearlyContribution,0):0,currentTotal:safeNumber(value.currentTotal??fallback.currentTotal,0),archived:value.archived===true,createdAt:safeDateTime(value.createdAt||fallback.createdAt)}}
function normalizeSettings(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const meganMortgage=safeNumber(source.meganR1??starter.settings.meganR1);
  const legacyKevinMortgage=safeNumber(source.kevinMortgage??starter.settings.kevinMortgage,0);
  const mortgagePayment=safeNumber(source.mortgagePayment??round(legacyKevinMortgage+meganMortgage),0);
  const settings={monthlyIncome:safeNumber(source.monthlyIncome??starter.settings.monthlyIncome,0),fixedExpenses:safeNumber(source.fixedExpenses??starter.settings.fixedExpenses,0),mortgagePayment,kevinMortgage:round(mortgagePayment-meganMortgage),foodShare:safeNumber(source.foodShare??starter.settings.foodShare,0,100),meganR1:meganMortgage,meganR2:safeNumber(source.meganR2??starter.settings.meganR2)};
  if(Array.isArray(source.fixedExpenseItems))settings.fixedExpenseItems=source.fixedExpenseItems.slice(0,100).filter(item=>item&&typeof item==='object'&&!Array.isArray(item)).map(item=>({id:safeId(item.id,'fixed'),label:safeText(item.label||'Expense',80),amount:safeNumber(item.amount)}));
  if(Array.isArray(source.incomeLevels))settings.incomeLevels=source.incomeLevels.slice(0,100).filter(item=>item&&typeof item==='object'&&!Array.isArray(item)&&safeMonthId(item.start)).map(item=>({id:safeId(item.id,'income'),start:safeMonthId(item.start),end:safeMonthId(item.end),paycheck:safeNumber(item.paycheck,0)}));
  const accountSource=Array.isArray(source.investmentAccounts)&&source.investmentAccounts.length?source.investmentAccounts.slice(0,100):defaultInvestmentAccounts;
  const seen=new Set();
  settings.investmentAccounts=accountSource.map((item,index)=>normalizeInvestmentAccount(item,defaultInvestmentAccounts[index]||{})).filter(account=>account&&!seen.has(account.id)&&seen.add(account.id));
  if(typeof source.incomeHistoryLocked==='boolean')settings.incomeHistoryLocked=source.incomeHistoryLocked;
  if(safeMonthId(source.meganReminderSeen))settings.meganReminderSeen=safeMonthId(source.meganReminderSeen);
  return settings;
}
function normalizeAppData(value){const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{},months=Array.isArray(source.months)?source.months.slice(0,240).map(month=>normalizeMonthRecord(month)).filter(Boolean):[],settings=normalizeSettings(source.settings),rawInvestments=Array.isArray(source.investments)?source.investments.slice(0,20000):[],investments=rawInvestments.map(entry=>normalizeInvestmentRecord(entry)).filter(Boolean),balanceMap=new Map();if(Array.isArray(source.investmentBalances))source.investmentBalances.slice(0,20000).forEach(value=>{const entry=normalizeInvestmentBalanceRecord(value);if(entry)balanceMap.set(`${entry.accountId}|${entry.date}`,entry)});rawInvestments.forEach(value=>{if(value?.currentTotal===undefined||value?.currentTotal===null||value?.currentTotal==='')return;const entry=normalizeInvestmentBalanceRecord({id:`${value.accountId}-${value.date}`,accountId:value.accountId,date:value.date,total:value.currentTotal,createdAt:value.createdAt,updatedAt:value.updatedAt});if(entry){const key=`${entry.accountId}|${entry.date}`;if(!balanceMap.has(key))balanceMap.set(key,entry)}});const today=new Date().toISOString().slice(0,10);settings.investmentAccounts.forEach(account=>{if(num(account.currentTotal)<=0||[...balanceMap.values()].some(entry=>entry.accountId===account.id))return;const entry=normalizeInvestmentBalanceRecord({id:`${account.id}-${today}`,accountId:account.id,date:today,total:account.currentTotal,createdAt:new Date().toISOString()});if(entry)balanceMap.set(`${entry.accountId}|${entry.date}`,entry)});return{months,entries:Array.isArray(source.entries)?source.entries.slice(0,10000).map(entry=>normalizeExpenseRecord(entry)).filter(Boolean):[],extraIncome:Array.isArray(source.extraIncome)?source.extraIncome.slice(0,10000).map(entry=>normalizeExtraIncomeRecord(entry)).filter(Boolean):[],investments,investmentBalances:[...balanceMap.values()],accounts:Array.isArray(source.accounts)?source.accounts.slice(0,100).map(entry=>normalizeAccountRecord(entry)).filter(Boolean):[],settings}}
let storedData=null;try{storedData=JSON.parse(localStorage.getItem(key)||'null')}catch(error){console.warn('Ignored invalid local budget data.',error)}let data=normalizeAppData(storedData||starter);const currentYear=new Date().getFullYear();function ensureYear(year){for(let i=0;i<12;i++){const id=`${year}-${String(i+1).padStart(2,'0')}`;if(!data.months.some(month=>month.id===id))data.months.push({id,label:`${monthLabels[i]} ${year}`,water:0,electricity:0,gas:0,groceries:0,spending:0,cashOffset:0,notes:''})}}ensureYear(currentYear);ensureYear(currentYear+1);data.months.sort((a,b)=>a.id.localeCompare(b.id));let active=data.months.find(month=>month.id.startsWith(String(currentYear)))?.id||data.months.at(-1).id,selectedYear=String(currentYear); const save=()=>localStorage.setItem(key,JSON.stringify(data));
function total(m){const s=data.settings,utilities=m.water+m.electricity+m.gas,kevinFood=m.groceries*s.foodShare/100,megan=m.groceries*(1-s.foodShare/100)+s.meganR1+s.meganR2,expenses=s.fixedExpenses+s.kevinMortgage+utilities+kevinFood-m.cashOffset;return{utilities,megan,expenses,saved:s.monthlyIncome-expenses-m.spending}};
function monthTable(months){return `<div class="table-wrap"><table class="table"><thead><tr><th>Month</th><th>Water</th><th>Electricity</th><th>Gas</th><th>Groceries</th><th>Spending</th><th>Megan owes</th><th>Saved</th><th aria-label="Actions"></th></tr></thead><tbody>${months.map(x=>{const q=total(x);return `<tr><th>${x.label}</th>${['water','electricity','gas','groceries'].map(k=>`<td><input type="number" data-month="${x.id}" data-key="${k}" value="${round(x[k])}"></td>`).join('')}<td><div class="spending-cell"><input type="number" data-month="${x.id}" data-key="spending" value="${round(x.spending)}"><button class="notes-button ${x.notes?'has-notes':''}" data-notes-month="${x.id}" aria-label="Edit notes for ${x.label}" title="${x.notes?'Edit notes':'Add notes'}">▤</button></div></td><td class="megan">${money(q.megan)}</td><td class="saved">${money(q.saved)}</td><td class="actions"><details><summary aria-label="More actions">•••</summary><div class="action-menu"><button data-offset-month="${x.id}">Add cash offset</button></div></details></td></tr>`}).join('')}</tbody></table></div>`}
function render(){const m=data.months.find(x=>x.id===active),today=new Date(),calendarYear=today.getFullYear(),isJanuary=today.getMonth()===0,savingsYear=isJanuary?calendarYear-1:calendarYear,completedMonthCount=isJanuary?12:today.getMonth(),savedMonths=data.months.filter(x=>Number(x.id.slice(0,4))===savingsYear&&(isJanuary||Number(x.id.slice(5,7))<=completedMonthCount)),previousYear=savingsYear-1,previousSavedMonths=data.months.filter(x=>Number(x.id.slice(0,4))===previousYear),savedTotal=savedMonths.reduce((sum,x)=>sum+total(x).saved,0),savedAverage=savedMonths.length?savedTotal/savedMonths.length:0,previousTotal=previousSavedMonths.reduce((sum,x)=>sum+total(x).saved,0),previousAverage=previousSavedMonths.length?previousTotal/previousSavedMonths.length:0,periodLabel=isJanuary?'Last Year':'This Year',comparisonLabel=isJanuary?String(previousYear):'Last year';monthPicker.innerHTML=data.months.map(x=>`<option value="${x.id}">${x.label}</option>`).join('');monthPicker.value=active;expenseMonth.innerHTML=monthPicker.innerHTML;expenseMonth.value=active;metrics.innerHTML=`<article class="metric orange"><p>Spent This Month</p><strong>${money(m.spending)}</strong></article><article class="metric violet"><p>Groceries This Month</p><strong>${money(m.groceries)}</strong></article><article class="metric green"><p>Avg Saved ${periodLabel}</p><strong>${money(savedAverage)}</strong><span>${comparisonLabel}: ${money(previousAverage)}</span></article><article class="metric"><p>Total Saved ${periodLabel}</p><strong>${money(savedTotal)}</strong><span>${comparisonLabel}: ${money(previousTotal)}</span></article>`;const years=[...new Set(data.months.map(x=>x.id.slice(0,4)))].sort((a,b)=>Number(b)-Number(a));if(!years.includes(selectedYear))selectedYear=years.includes(String(currentYear))?String(currentYear):years[0];yearTimeline.innerHTML=years.map(itemYear=>{const group=data.months.filter(x=>x.id.startsWith(itemYear)),totalSaved=Math.round(group.reduce((sum,x)=>sum+total(x).saved,0));return `<button class="${itemYear===selectedYear?'selected':''}" data-year-tab="${itemYear}"><strong>${itemYear}</strong><span>Total saved ${money(totalSaved)}</span></button>`}).join('');monthlyYearTable.innerHTML=monthTable(data.months.filter(x=>x.id.startsWith(selectedYear)));document.querySelectorAll('[data-setting]').forEach(i=>i.value=round(data.settings[i.dataset.setting]));const configInput=document.getElementById('firebaseConfig');if(configInput&&document.activeElement!==configInput)configInput.value=localStorage.getItem('cream-corn-firebase-config')||JSON.stringify(builtInFirebaseConfig,null,2);}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.app > section').forEach(x=>x.classList.add('hidden'));b.classList.add('active');document.getElementById(b.dataset.tab).classList.remove('hidden')});monthPicker.onchange=e=>{active=e.target.value;render()};document.addEventListener('change',e=>{const el=e.target;if(el.dataset.month){const month=data.months.find(x=>x.id===el.dataset.month);month[el.dataset.key]=num(el.value);save();syncMonth(month);render()}if(el.dataset.setting){data.settings[el.dataset.setting]=num(el.value);if(el.dataset.setting==='mortgagePayment'||el.dataset.setting==='meganR1')data.settings.kevinMortgage=round(num(data.settings.mortgagePayment)-num(data.settings.meganR1));save();syncSettings();render()}});
const builtInFirebaseConfig={apiKey:'AIzaSyAmBvHoVCBm7mbOx_v9wPQeq-FwQ0F59eo',authDomain:'cream-corn-8e8ea.firebaseapp.com',projectId:'cream-corn-8e8ea',storageBucket:'cream-corn-8e8ea.firebasestorage.app',messagingSenderId:'323631470609',appId:'1:323631470609:web:f1547cb37954e4fa0bb9b0'},ownerUid='R9klEiIEcsMZBrJwn12BaScJE8J2';
let firebaseClient=null,firebaseUser=null,firebaseUnsubscribers=[],clearPrivateDataAfterAuthChange=false;
const firebaseStatusMessage=message=>{const el=document.getElementById('firebaseStatus');if(el)el.textContent=message};
const cleanMonth=month=>normalizeMonthRecord(month);
const freshMonth=id=>{const monthNumber=Number(id.slice(5,7))-1;return {id,label:`${monthLabels[monthNumber]} ${id.slice(0,4)}`,water:0,electricity:0,gas:0,groceries:0,spending:0,cashOffset:0,notes:''}};
const firebasePath=collectionName=>['users',firebaseUser.uid,collectionName];
let latestLocalSettingsUpdate=0,latestLocalInvestmentSettingsUpdate=0;
const settingsTimestamp=value=>{const numeric=Number(value);return Number.isFinite(numeric)?numeric:(Date.parse(value)||0)};
const investmentSettingsScore=accounts=>accounts.length*100+accounts.reduce((score,account,index)=>{const original=defaultInvestmentAccounts[index];return score+(!original||account.id!==original.id||account.name!==original.name||account.type!==original.type?1:0)},0);
async function syncSettings(){if(!firebaseClient||!firebaseUser)return;latestLocalSettingsUpdate=Date.now();const{investmentAccounts,...generalSettings}=data.settings;try{await firebaseClient.setDoc(firebaseClient.doc(firebaseClient.db,...firebasePath('budget'),'settings'),{settings:generalSettings,updatedAt:latestLocalSettingsUpdate})}catch(error){console.error(error);firebaseStatusMessage('Could not sync Settings. Your local changes are still saved here.')}}
async function syncInvestmentSettings(){if(!firebaseClient||!firebaseUser)return;latestLocalInvestmentSettingsUpdate=Date.now();try{await firebaseClient.setDoc(firebaseClient.doc(firebaseClient.db,...firebasePath('budget'),'investmentSettings'),{investmentAccounts:data.settings.investmentAccounts.map(account=>({...account})),updatedAt:latestLocalInvestmentSettingsUpdate})}catch(error){console.error(error);firebaseStatusMessage('Could not sync Investment Settings. Your local changes are still saved here.')}}
async function loadInvestmentSettings(){
  if(!firebaseClient||!firebaseUser)return;
  const localAccounts=normalizeSettings({investmentAccounts:data.settings.investmentAccounts}).investmentAccounts;
  const investmentRef=firebaseClient.doc(firebaseClient.db,...firebasePath('budget'),'investmentSettings');
  const investmentSnapshot=await firebaseClient.getDoc(investmentRef);
  if(investmentSnapshot.exists()&&Array.isArray(investmentSnapshot.data().investmentAccounts)){
    const remote=investmentSnapshot.data();
    const remoteAccounts=normalizeSettings({investmentAccounts:remote.investmentAccounts}).investmentAccounts;
    if(investmentSettingsScore(localAccounts)>investmentSettingsScore(remoteAccounts)){
      data.settings.investmentAccounts=localAccounts;
      save();
      await syncInvestmentSettings();
      return;
    }
    data.settings.investmentAccounts=remoteAccounts;
    latestLocalInvestmentSettingsUpdate=settingsTimestamp(remote.updatedAt);
    save();
    return;
  }
  const legacyRef=firebaseClient.doc(firebaseClient.db,...firebasePath('budget'),'settings');
  const legacySnapshot=await firebaseClient.getDoc(legacyRef);
  const legacyRaw=legacySnapshot.exists()?legacySnapshot.data()?.settings?.investmentAccounts:null;
  const legacyAccounts=Array.isArray(legacyRaw)&&legacyRaw.length?normalizeSettings({investmentAccounts:legacyRaw}).investmentAccounts:[];
  data.settings.investmentAccounts=investmentSettingsScore(localAccounts)>=investmentSettingsScore(legacyAccounts)?localAccounts:legacyAccounts;
  save();
  await syncInvestmentSettings();
}
const syncGeneralSettingsOnly=syncSettings;syncSettings=async()=>{await syncGeneralSettingsOnly();await syncInvestmentSettings()};
async function syncMonth(month){if(!firebaseClient||!firebaseUser)return;try{await firebaseClient.setDoc(firebaseClient.doc(firebaseClient.db,...firebasePath('months'),month.id),{...cleanMonth(month),updatedAt:new Date().toISOString()})}catch(error){console.error(error);firebaseStatusMessage('Could not sync this month. Your local changes are still saved here.')}}
async function addCloudExpense(entry,keyName){if(!firebaseClient||!firebaseUser)return;const monthId=entry.month,monthRef=firebaseClient.doc(firebaseClient.db,...firebasePath('months'),monthId),entryRef=firebaseClient.doc(firebaseClient.db,...firebasePath('expenses'),entry.id);try{await firebaseClient.runTransaction(firebaseClient.db,async transaction=>{const snapshot=await transaction.get(monthRef),remote=cleanMonth(snapshot.exists()?snapshot.data():freshMonth(monthId));remote[keyName]=round(remote[keyName]+entry.final);transaction.set(monthRef,{...remote,updatedAt:new Date().toISOString()})});await firebaseClient.setDoc(entryRef,entry)}catch(error){console.error(error);firebaseStatusMessage('Could not sync this expense yet. It remains saved on this device.')}}
async function addCloudCashOffset(monthId,amount){if(!firebaseClient||!firebaseUser)return;const monthRef=firebaseClient.doc(firebaseClient.db,...firebasePath('months'),monthId);try{await firebaseClient.runTransaction(firebaseClient.db,async transaction=>{const snapshot=await transaction.get(monthRef),remote=cleanMonth(snapshot.exists()?snapshot.data():freshMonth(monthId));remote.cashOffset=round(remote.cashOffset+amount);transaction.set(monthRef,{...remote,updatedAt:new Date().toISOString()})})}catch(error){console.error(error);firebaseStatusMessage('Could not sync this cash offset yet. It remains saved on this device.')}}
async function syncExtraIncomeRecord(entry){if(!firebaseClient||!firebaseUser)return;await firebaseClient.setDoc(firebaseClient.doc(firebaseClient.db,...firebasePath('extraIncome'),entry.id),entry)}
async function addCloudExtraIncome(entry){if(!firebaseClient||!firebaseUser)return;const monthRef=firebaseClient.doc(firebaseClient.db,...firebasePath('months'),entry.month),incomeRef=firebaseClient.doc(firebaseClient.db,...firebasePath('extraIncome'),entry.id);try{await firebaseClient.runTransaction(firebaseClient.db,async transaction=>{const snapshot=await transaction.get(monthRef),remote=cleanMonth(snapshot.exists()?snapshot.data():freshMonth(entry.month));remote.spending=round(remote.spending-entry.amount);transaction.set(monthRef,{...remote,updatedAt:new Date().toISOString()});transaction.set(incomeRef,entry)})}catch(error){console.error(error);firebaseStatusMessage('Could not sync this extra income yet. It remains saved on this device.')}}
async function updateCloudExtraIncome(previous,entry){if(!firebaseClient||!firebaseUser)return;const oldMonthRef=firebaseClient.doc(firebaseClient.db,...firebasePath('months'),previous.month),newMonthRef=firebaseClient.doc(firebaseClient.db,...firebasePath('months'),entry.month),incomeRef=firebaseClient.doc(firebaseClient.db,...firebasePath('extraIncome'),entry.id);try{await firebaseClient.runTransaction(firebaseClient.db,async transaction=>{if(previous.month===entry.month){const snapshot=await transaction.get(oldMonthRef),remote=cleanMonth(snapshot.exists()?snapshot.data():freshMonth(previous.month));remote.spending=round(remote.spending+previous.amount-entry.amount);transaction.set(oldMonthRef,{...remote,updatedAt:new Date().toISOString()})}else{const oldSnapshot=await transaction.get(oldMonthRef),newSnapshot=await transaction.get(newMonthRef),oldRemote=cleanMonth(oldSnapshot.exists()?oldSnapshot.data():freshMonth(previous.month)),newRemote=cleanMonth(newSnapshot.exists()?newSnapshot.data():freshMonth(entry.month));oldRemote.spending=round(oldRemote.spending+previous.amount);newRemote.spending=round(newRemote.spending-entry.amount);transaction.set(oldMonthRef,{...oldRemote,updatedAt:new Date().toISOString()});transaction.set(newMonthRef,{...newRemote,updatedAt:new Date().toISOString()})}transaction.set(incomeRef,entry)})}catch(error){console.error(error);firebaseStatusMessage('Could not sync this extra income edit yet. It remains saved on this device.')}}
async function deleteCloudExtraIncome(entry){if(!firebaseClient||!firebaseUser)return;const monthRef=firebaseClient.doc(firebaseClient.db,...firebasePath('months'),entry.month),incomeRef=firebaseClient.doc(firebaseClient.db,...firebasePath('extraIncome'),entry.id);try{await firebaseClient.runTransaction(firebaseClient.db,async transaction=>{const snapshot=await transaction.get(monthRef),remote=cleanMonth(snapshot.exists()?snapshot.data():freshMonth(entry.month));remote.spending=round(remote.spending+entry.amount);transaction.set(monthRef,{...remote,updatedAt:new Date().toISOString()});transaction.delete(incomeRef)})}catch(error){console.error(error);firebaseStatusMessage('Could not delete this extra income from sync yet. It remains removed on this device.')}}
async function syncInvestmentRecord(entry){if(!firebaseClient||!firebaseUser)return;try{await firebaseClient.setDoc(firebaseClient.doc(firebaseClient.db,...firebasePath('investments'),entry.id),entry)}catch(error){console.error(error);firebaseStatusMessage('Could not sync this investment yet. It remains saved on this device.')}}
async function deleteCloudInvestment(id){if(!firebaseClient||!firebaseUser)return;try{await firebaseClient.deleteDoc(firebaseClient.doc(firebaseClient.db,...firebasePath('investments'),id))}catch(error){console.error(error);firebaseStatusMessage('Could not delete this investment from sync yet. It remains removed on this device.')}}
async function syncInvestmentBalanceRecord(entry){if(!firebaseClient||!firebaseUser)return;try{await firebaseClient.setDoc(firebaseClient.doc(firebaseClient.db,...firebasePath('investmentBalances'),entry.id),entry)}catch(error){console.error(error);firebaseStatusMessage('Could not sync this balance update yet. It remains saved on this device.')}}
async function migrateLegacyInvestmentBalanceRecord(entry){if(!firebaseClient||!firebaseUser)return;const reference=firebaseClient.doc(firebaseClient.db,...firebasePath('investmentBalances'),entry.id);try{await firebaseClient.runTransaction(firebaseClient.db,async transaction=>{const snapshot=await transaction.get(reference);if(!snapshot.exists())transaction.set(reference,entry)})}catch(error){console.warn('Could not migrate a legacy investment balance.',error)}}
async function syncAccountRecord(entry){if(!firebaseClient||!firebaseUser)return;try{await firebaseClient.setDoc(firebaseClient.doc(firebaseClient.db,...firebasePath('accounts'),entry.id),entry)}catch(error){console.error(error);firebaseStatusMessage('Could not sync this account yet. It remains saved on this device.')}}
async function deleteCloudAccount(id){if(!firebaseClient||!firebaseUser)return;try{await firebaseClient.deleteDoc(firebaseClient.doc(firebaseClient.db,...firebasePath('accounts'),id))}catch(error){console.error(error);firebaseStatusMessage('Could not delete this account from sync yet. It remains removed on this device.')}}
async function migrateLocalData(){const monthsCollection=firebaseClient.collection(firebaseClient.db,...firebasePath('months')),existing=await firebaseClient.getDocs(monthsCollection);if(!existing.empty)return false;await syncSettings();await syncInvestmentSettings();await Promise.all(data.months.map(syncMonth));await Promise.all(data.entries.map(entry=>{const id=entry.id||crypto.randomUUID();return firebaseClient.setDoc(firebaseClient.doc(firebaseClient.db,...firebasePath('expenses'),id),{...entry,id})}));await Promise.all(data.extraIncome.map(syncExtraIncomeRecord));await Promise.all(data.investments.map(syncInvestmentRecord));await Promise.all(data.investmentBalances.map(syncInvestmentBalanceRecord));await Promise.all(data.accounts.map(syncAccountRecord));return true}
function stopFirebaseListeners(){firebaseUnsubscribers.forEach(stop=>stop());firebaseUnsubscribers=[]}
function subscribeFirebase(){
  stopFirebaseListeners();
  const settingsRef=firebaseClient.doc(firebaseClient.db,...firebasePath('budget'),'settings');
  const investmentSettingsRef=firebaseClient.doc(firebaseClient.db,...firebasePath('budget'),'investmentSettings');
  const monthsRef=firebaseClient.collection(firebaseClient.db,...firebasePath('months'));
  const entriesRef=firebaseClient.collection(firebaseClient.db,...firebasePath('expenses'));
  const extraIncomeRef=firebaseClient.collection(firebaseClient.db,...firebasePath('extraIncome'));
  const investmentsRef=firebaseClient.collection(firebaseClient.db,...firebasePath('investments'));
  const investmentBalancesRef=firebaseClient.collection(firebaseClient.db,...firebasePath('investmentBalances'));
  const accountsRef=firebaseClient.collection(firebaseClient.db,...firebasePath('accounts'));
  firebaseUnsubscribers.push(firebaseClient.onSnapshot(settingsRef,snapshot=>{
    if(!snapshot.exists()||!snapshot.data().settings)return;
    const remote=snapshot.data(),remoteUpdatedAt=settingsTimestamp(remote.updatedAt);
    if(remoteUpdatedAt&&remoteUpdatedAt<latestLocalSettingsUpdate)return;
    latestLocalSettingsUpdate=Math.max(latestLocalSettingsUpdate,remoteUpdatedAt);
    const{investmentAccounts:ignoredLegacyInvestmentAccounts,...remoteGeneralSettings}=remote.settings;
    if(!Object.hasOwn(remoteGeneralSettings,'mortgagePayment'))remoteGeneralSettings.mortgagePayment=round(num(remoteGeneralSettings.kevinMortgage??data.settings.kevinMortgage)+num(remoteGeneralSettings.meganR1??data.settings.meganR1));
    data.settings=normalizeSettings({...data.settings,...remoteGeneralSettings,investmentAccounts:data.settings.investmentAccounts});
    save();
    render();
  }));
  firebaseUnsubscribers.push(firebaseClient.onSnapshot(investmentSettingsRef,snapshot=>{if(!snapshot.exists()||!Array.isArray(snapshot.data().investmentAccounts))return;const remote=snapshot.data(),remoteUpdatedAt=settingsTimestamp(remote.updatedAt);if(remoteUpdatedAt&&remoteUpdatedAt<latestLocalInvestmentSettingsUpdate)return;latestLocalInvestmentSettingsUpdate=Math.max(latestLocalInvestmentSettingsUpdate,remoteUpdatedAt);data.settings.investmentAccounts=normalizeSettings({investmentAccounts:remote.investmentAccounts}).investmentAccounts;save();render()}));
  firebaseUnsubscribers.push(firebaseClient.onSnapshot(monthsRef,snapshot=>{if(!snapshot.empty){const merged=new Map(data.months.map(month=>[month.id,month]));snapshot.docs.forEach(record=>{const remote=normalizeMonthRecord(record.data(),record.id);if(!remote)return;merged.set(remote.id,{...(merged.get(remote.id)||freshMonth(remote.id)),...remote})});data.months=[...merged.values()].sort((a,b)=>a.id.localeCompare(b.id));ensureYear(currentYear);ensureYear(currentYear+1);save();render()}}));
  firebaseUnsubscribers.push(firebaseClient.onSnapshot(entriesRef,snapshot=>{data.entries=snapshot.docs.map(record=>normalizeExpenseRecord(record.data(),record.id)).filter(Boolean).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));save();render()}));
  firebaseUnsubscribers.push(firebaseClient.onSnapshot(extraIncomeRef,snapshot=>{data.extraIncome=snapshot.docs.map(record=>normalizeExtraIncomeRecord(record.data(),record.id)).filter(Boolean).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));save();render()}));
  firebaseUnsubscribers.push(firebaseClient.onSnapshot(investmentsRef,snapshot=>{const migrated=[];data.investments=snapshot.docs.map(record=>{const raw=record.data();if(raw?.currentTotal!==undefined&&raw?.currentTotal!==null&&raw?.currentTotal!==''){const balance=normalizeInvestmentBalanceRecord({id:`${raw.accountId}-${raw.date}`,accountId:raw.accountId,date:raw.date,total:raw.currentTotal,createdAt:raw.createdAt,updatedAt:raw.updatedAt});if(balance)migrated.push(balance)}return normalizeInvestmentRecord(raw,record.id)}).filter(Boolean).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.createdAt).localeCompare(String(a.createdAt)));migrated.forEach(migrateLegacyInvestmentBalanceRecord);save();render()}));
  firebaseUnsubscribers.push(firebaseClient.onSnapshot(investmentBalancesRef,snapshot=>{if(!snapshot.empty)data.investmentBalances=snapshot.docs.map(record=>normalizeInvestmentBalanceRecord(record.data(),record.id)).filter(Boolean).sort((a,b)=>String(a.date).localeCompare(String(b.date)));save();render()}));
  firebaseUnsubscribers.push(firebaseClient.onSnapshot(accountsRef,snapshot=>{data.accounts=snapshot.docs.map(record=>normalizeAccountRecord(record.data(),record.id)).filter(Boolean).sort((a,b)=>String(a.name).localeCompare(String(b.name)));save();render()}));
}
function clearPrivateLocalData(){localStorage.removeItem(key);data=normalizeAppData(starter);ensureYear(currentYear);ensureYear(currentYear+1);data.months.sort((a,b)=>a.id.localeCompare(b.id));active=data.months.find(month=>month.id===currentMonthKey())?.id||data.months.at(-1).id;selectedYear=String(currentYear)}
async function onFirebaseUser(user){firebaseUser=user;if(!user){stopFirebaseListeners();if(clearPrivateDataAfterAuthChange){clearPrivateLocalData();clearPrivateDataAfterAuthChange=false}firebaseStatusMessage('Firebase connected. Sign in with Google to sync your private budget.');return}if(user.uid!==ownerUid){stopFirebaseListeners();firebaseStatusMessage('This Google account is not authorized for Estuary.');clearPrivateDataAfterAuthChange=true;await firebaseClient.signOut(firebaseClient.auth);return}firebaseStatusMessage('Syncing as '+(user.email||'your Google account')+'…');try{const moved=await migrateLocalData();await loadInvestmentSettings();subscribeFirebase();firebaseStatusMessage(moved?'Local budget moved to Firebase and now syncing.':'Synced as '+(user.email||'your Google account')+'.')}catch(error){console.error(error);firebaseStatusMessage('Firebase connected, but the first sync failed. Check your Firestore rules.')}}
async function connectFirebase(){if(!window.CreamCornFirebase){firebaseStatusMessage('Firebase is still loading. Try again in a moment.');return}if(firebaseClient)return;try{const input=document.getElementById('firebaseConfig'),raw=input?.value.trim()||JSON.stringify(builtInFirebaseConfig),config=JSON.parse(raw);if(!config.apiKey||!config.authDomain||!config.projectId)throw new Error('Missing required configuration');localStorage.setItem('cream-corn-firebase-config',JSON.stringify(config));firebaseClient=window.CreamCornFirebase.create(config);firebaseClient.onAuthStateChanged(firebaseClient.auth,onFirebaseUser);firebaseStatusMessage('Firebase connected. Sign in with Google to start syncing.')}catch(error){console.error(error);firebaseStatusMessage('Firebase could not start. Reload Estuary and try again.')}}
async function signInFirebase(){if(!firebaseClient){await connectFirebase();if(!firebaseClient)return}try{await firebaseClient.signInWithPopup(firebaseClient.auth,new firebaseClient.GoogleAuthProvider())}catch(error){console.error(error);firebaseStatusMessage('Google sign-in did not finish. Add this GitHub Pages domain to Firebase Authorized domains, then try again.')}}
async function signOutFirebase(){if(!firebaseClient)return;clearPrivateDataAfterAuthChange=true;await firebaseClient.signOut(firebaseClient.auth);stopFirebaseListeners();firebaseUser=null;if(clearPrivateDataAfterAuthChange){clearPrivateLocalData();clearPrivateDataAfterAuthChange=false}render()}
window.addEventListener('firebase-sdk-ready',connectFirebase);
/* Legacy Dropbox implementation retained only for backwards-compatible local data; Firebase is the active sync provider.
const redirectUri=()=>location.origin+location.pathname;
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
async function connectDropbox(){const appKey=data.dropbox.appKey.trim();if(!appKey){notice.textContent='Paste your Dropbox App key first.';return}const verifier=b64url(crypto.getRandomValues(new Uint8Array(48)));const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));localStorage.setItem('cream-corn-pkce',JSON.stringify({verifier,redirectUri:redirectUri()}));const params=new URLSearchParams({client_id:appKey,response_type:'code',redirect_uri:redirectUri(),code_challenge:b64url(new Uint8Array(digest)),code_challenge_method:'S256',token_access_type:'online',scope:'account_info.read files.metadata.read files.content.read files.content.write'});location.assign('https://www.dropbox.com/oauth2/authorize?'+params)}
async function finishDropboxLogin(){const code=new URLSearchParams(location.search).get('code'),pkce=JSON.parse(localStorage.getItem('cream-corn-pkce')||'null');if(!code||!pkce)return;notice.textContent='Finishing Dropbox sign-in…';try{const body=new URLSearchParams({code,grant_type:'authorization_code',client_id:data.dropbox.appKey,code_verifier:pkce.verifier,redirect_uri:pkce.redirectUri});const tokenResponse=await fetch('https://api.dropboxapi.com/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});if(!tokenResponse.ok)throw new Error(await tokenResponse.text());const token=await tokenResponse.json();const accountResponse=await fetch('https://api.dropboxapi.com/2/users/get_current_account',{method:'POST',headers:{Authorization:'Bearer '+token.access_token}});if(!accountResponse.ok)throw new Error(await accountResponse.text());const account=await accountResponse.json();data.dropbox.accessToken=token.access_token;data.dropbox.name=account.name?.display_name||account.email||'Dropbox';save();history.replaceState({},'',redirectUri());notice.textContent='Dropbox connected. Your workbook path is ready for sync.';render()}catch(error){notice.textContent='Dropbox sign-in did not finish. Check the redirect URI and app permissions, then try again.';console.error(error)}finally{localStorage.removeItem('cream-corn-pkce')}}
const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
const cellValue=(sheet,address)=>{const value=sheet[address]?.v;return typeof value==='number'&&Number.isFinite(value)?round(value):0};
const workbookNumber=(sheet,address)=>{const value=sheet[address]?.v;return typeof value==='number'&&Number.isFinite(value)?round(value):null};
async function fetchWorkbook(){if(!data.dropbox.accessToken)throw new Error('Connect Dropbox first.');const meta=await fetch('https://api.dropboxapi.com/2/files/get_metadata',{method:'POST',headers:{Authorization:'Bearer '+data.dropbox.accessToken,'Content-Type':'application/json'},body:JSON.stringify({path:data.dropbox.filePath})});if(!meta.ok)throw new Error(await meta.text());const metadata=await meta.json();const downloaded=await fetch('https://content.dropboxapi.com/2/files/download',{method:'POST',headers:{Authorization:'Bearer '+data.dropbox.accessToken,'Dropbox-API-Arg':JSON.stringify({path:data.dropbox.filePath})}});if(!downloaded.ok)throw new Error(await downloaded.text());return {book:XLSX.read(await downloaded.arrayBuffer(),{type:'array',cellFormula:true}),revision:metadata.rev};}
function importBudget(book,revision){const sheet=book.Sheets.Budget;if(!sheet)throw new Error('No worksheet named “Budget” was found.');let year='',rowMap={},imported=[];const range=XLSX.utils.decode_range(sheet['!ref']||'A1:A1');for(let row=range.s.r;row<=range.e.r;row++){const a=sheet[XLSX.utils.encode_cell({r:row,c:0})]?.v;const text=String(a||'').trim();const yearMatch=text.match(/(?:~)?(20\d{2})(?:~)?/);if(yearMatch&&text.includes('~')){year=yearMatch[1];continue}const index=monthNames.findIndex(name=>name.toLowerCase()===text.toLowerCase());if(index<0||!year)continue;const id=`${year}-${String(index+1).padStart(2,'0')}`,excelRow=row+1;imported.push({id,label:`${monthNames[index]} ${year}`,water:cellValue(sheet,`B${excelRow}`),electricity:cellValue(sheet,`C${excelRow}`),gas:cellValue(sheet,`D${excelRow}`),groceries:cellValue(sheet,`F${excelRow}`),spending:cellValue(sheet,`I${excelRow}`),cashOffset:cellValue(sheet,`P${excelRow}`),notes:String(sheet[`O${excelRow}`]?.v||'')});rowMap[id]=excelRow}if(!imported.length)throw new Error('No month rows were found in column A.');data.months=imported;ensureYear(currentYear);ensureYear(currentYear+1);data.months.sort((a,b)=>a.id.localeCompare(b.id));data.dropbox.rowMap=rowMap;data.dropbox.revision=revision;for(const [key,cell] of Object.entries({fixedExpenses:'U2',kevinMortgage:'R2',monthlyIncome:'R9',meganR1:'R4',meganR2:'R5'})){const value=workbookNumber(sheet,cell);if(value!==null)data.settings[key]=value}const formulaRow=imported.find(month=>sheet[`G${rowMap[month.id]}`]?.f);const formula=String(formulaRow?sheet[`G${rowMap[formulaRow.id]}`]?.f||'':'');const share=formula.match(/\*\s*(0?\.\d+|1(?:\.0+)?)/);if(share)data.settings.foodShare=round(Number(share[1])*100);active=`${currentYear}-${String(new Date().getMonth()+1).padStart(2,'0')}`;save();}
const importBudgetWithoutMortgageTotal=importBudget;importBudget=(book,revision)=>{importBudgetWithoutMortgageTotal(book,revision);data.settings.mortgagePayment=round(num(data.settings.kevinMortgage)+num(data.settings.meganR1));save()};
async function pullFromDropbox(){notice.textContent='Pulling your Budget workbook from Dropbox…';try{const {book,revision}=await fetchWorkbook();importBudget(book,revision);notice.textContent='Budget imported from Dropbox.';render()}catch(error){notice.textContent='Could not pull the workbook. Confirm the path, scopes, and worksheet name.';console.error(error)}}
function setCell(sheet,address,value){sheet[address]={t:typeof value==='number'?'n':'s',v:typeof value==='number'?round(value):value};}
function setFormula(sheet,address,formula,cachedValue){sheet[address]={...(sheet[address]||{}),t:'n',f:formula,v:round(cachedValue)};}
function percentageFactor(value){return String(round(Math.max(0,Math.min(100,num(value)))/100));}
function applyBudgetChanges(book){const sheet=book.Sheets.Budget;if(!sheet)throw new Error('No worksheet named “Budget” was found.');const settings=data.settings,foodFactor=percentageFactor(settings.foodShare),meganFoodFactor=percentageFactor(100-settings.foodShare);setCell(sheet,'P1','Cash offset');(sheet['!cols']||=[])[15]={hidden:true};const fixedComponentTotal=['U3','U4','U5','U6','U7','U8','U9','U10'].reduce((sum,cell)=>sum+num(sheet[cell]?.v),0);setCell(sheet,'T16','CREAM CORN FIXED-EXPENSE ADJUSTMENT');setCell(sheet,'U16',round(settings.fixedExpenses-fixedComponentTotal));setFormula(sheet,'U2','SUM(U3:U10)+U16',settings.fixedExpenses);setCell(sheet,'R4',settings.meganR1);setCell(sheet,'R7',round(settings.monthlyIncome*12/26));setFormula(sheet,'R9','PRODUCT((R7*26))/12',settings.monthlyIncome);setCell(sheet,'U15',round(settings.kevinMortgage+settings.meganR1));setFormula(sheet,'R2','PRODUCT(U15-R4)',settings.kevinMortgage);const meganOtherStatic=num(sheet.U10?.v)+num(sheet.U11?.v)+num(sheet.U12?.v);setCell(sheet,'U13',round(settings.meganR2-meganOtherStatic));setFormula(sheet,'R5','PRODUCT(U12+U13+U11+U10)',settings.meganR2);for(const month of data.months){const row=data.dropbox.rowMap?.[month.id];if(!row)continue;setCell(sheet,`B${row}`,month.water);setCell(sheet,`C${row}`,month.electricity);setCell(sheet,`D${row}`,month.gas);setCell(sheet,`F${row}`,month.groceries);setFormula(sheet,`G${row}`,`PRODUCT(F${row}*${foodFactor})`,month.groceries*Number(foodFactor));setFormula(sheet,`L${row}`,`PRODUCT(F${row}*${meganFoodFactor})`,month.groceries*Number(meganFoodFactor));setCell(sheet,`I${row}`,month.spending);setCell(sheet,`O${row}`,month.notes||'');setCell(sheet,`P${row}`,month.cashOffset);const j=sheet[`J${row}`];if(j?.f&&!j.f.includes(`P${row}`))j.f=`(${j.f})+P${row}`;}const ledger=XLSX.utils.aoa_to_sheet([['Timestamp','Month','Type','Original amount','Modifier','Final amount'],...data.entries.map(e=>[e.createdAt,e.month,e.type,e.original,e.modifier,e.final])]);book.Sheets['Cream Corn Ledger']=ledger;if(!book.SheetNames.includes('Cream Corn Ledger'))book.SheetNames.push('Cream Corn Ledger');}
async function pushToDropbox(){notice.textContent='Preparing your workbook for Dropbox…';try{const {book,revision}=await fetchWorkbook();if(data.dropbox.revision&&revision!==data.dropbox.revision&&!confirm('The workbook changed in Dropbox since your last pull. Push your current app totals anyway?')){notice.textContent='Push cancelled. Pull from Dropbox first to review its newer data.';return}applyBudgetChanges(book);const bytes=XLSX.write(book,{bookType:'xlsx',type:'array'});const upload=await fetch('https://content.dropboxapi.com/2/files/upload',{method:'POST',headers:{Authorization:'Bearer '+data.dropbox.accessToken,'Content-Type':'application/octet-stream','Dropbox-API-Arg':JSON.stringify({path:data.dropbox.filePath,mode:{'.tag':'update',update:revision},autorename:false,mute:false})},body:bytes});if(!upload.ok)throw new Error(await upload.text());const saved=await upload.json();data.dropbox.revision=saved.rev;save();notice.textContent='Budget workbook updated in Dropbox.';render()}catch(error){notice.textContent='Could not push the workbook. Pull it first, then check your Dropbox permissions.';console.error(error)}}
*/
function addCashOffset(monthId){const amount=num(prompt('Bulk cash received that should reduce this month’s expenses:'));if(amount>0){data.months.find(x=>x.id===monthId).cashOffset+=amount;save();addCloudCashOffset(monthId,amount);notice.textContent=money(amount)+' added as a cash offset.';render()}}
const dialog=document.getElementById('expenseDialog');addExpense.onclick=()=>dialog.showModal();cancelExpense.onclick=()=>dialog.close();function preview(){finalAmount.textContent=money(num(expenseAmount.value)*Math.max(.9,Math.min(1,num(expenseModifier.value))));}expenseAmount.oninput=preview;expenseModifier.oninput=preview;saveExpense.onclick=()=>{const original=num(expenseAmount.value),modifier=Math.max(.9,Math.min(1,num(expenseModifier.value)));if(original<=0)return notice.textContent='Enter a positive expense amount.';const final=Math.round(original*modifier*100)/100,type=expenseType.value,keyName=type.toLowerCase();data.months.find(x=>x.id===expenseMonth.value)[keyName]+=final;data.entries.unshift({type,month:expenseMonth.value,original,modifier,final,createdAt:new Date().toISOString()});active=expenseMonth.value;save();dialog.close();expenseAmount.value='';notice.textContent=money(final)+' added to '+type.toLowerCase()+'.';render()};document.addEventListener('click',event=>{const button=event.target.closest('[data-offset-month]');if(button)addCashOffset(button.dataset.offsetMonth)});const applyTheme=theme=>{document.documentElement.dataset.theme=theme;localStorage.setItem('cream-corn-theme',theme);document.getElementById('themeToggle').textContent=theme==='dark'?'Light mode':'Dark mode'};document.getElementById('themeToggle').onclick=()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');applyTheme(localStorage.getItem('cream-corn-theme')||'dark');document.getElementById('firebaseSignIn').onclick=signInFirebase;document.getElementById('firebaseSignOut').onclick=signOutFirebase;render();
document.querySelectorAll('[data-expense-type]').forEach(button=>button.onclick=()=>{expenseType.value=button.dataset.expenseType;document.querySelectorAll('[data-expense-type]').forEach(item=>item.classList.toggle('selected',item===button));commentField.classList.toggle('hidden',expenseType.value!=='Spending')});document.querySelectorAll('[data-expense-modifier]').forEach(button=>button.onclick=()=>{expenseModifier.value=button.dataset.expenseModifier;document.querySelectorAll('[data-expense-modifier]').forEach(item=>item.classList.toggle('selected',item===button));preview()});commentField.classList.toggle('hidden',expenseType.value!=='Spending');saveExpense.onclick=()=>{const original=num(expenseAmount.value),modifier=Math.max(.9,Math.min(1,num(expenseModifier.value)));if(original<=0)return notice.textContent='Enter a positive expense amount.';const final=round(original*modifier),type=expenseType.value,keyName=type.toLowerCase(),comment=type==='Spending'?expenseComment.value.trim():'';data.months.find(x=>x.id===expenseMonth.value)[keyName]=round(data.months.find(x=>x.id===expenseMonth.value)[keyName]+final);data.entries.unshift({type,month:expenseMonth.value,original,modifier,final,comment,createdAt:new Date().toISOString()});active=expenseMonth.value;save();dialog.close();expenseAmount.value='';expenseComment.value='';notice.textContent=money(final)+' added to '+type.toLowerCase()+'.';render()};document.addEventListener('click',event=>{const tab=event.target.closest('[data-year-tab]');if(tab){selectedYear=tab.dataset.yearTab;render()}});
saveExpense.onclick=()=>{const original=num(expenseAmount.value),modifier=Math.max(.9,Math.min(1,num(expenseModifier.value)));if(original<=0)return notice.textContent='Enter a positive expense amount.';const final=round(original*modifier),type=expenseType.value,keyName=type.toLowerCase(),comment=type==='Spending'?expenseComment.value.trim():'',entry={id:crypto.randomUUID(),type,month:expenseMonth.value,original,modifier,final,comment,createdAt:new Date().toISOString()};const month=data.months.find(x=>x.id===entry.month);month[keyName]=round(month[keyName]+final);if(original>200&&comment)appendExpenseCommentToNotes(month,entry);data.entries.unshift(entry);addCloudExpense(entry,keyName);syncMonth(month);active=entry.month;save();dialog.close();expenseAmount.value='';expenseComment.value='';notice.textContent=money(final)+' added to '+type.toLowerCase()+'.';render()};
const renameSetting=(key,label)=>{const input=document.querySelector(`[data-setting="${key}"]`);if(input?.parentNode.firstChild)input.parentNode.firstChild.nodeValue=label};renameSetting('monthlyIncome','Kevin monthly income');renameSetting('kevinMortgage','Kevin Mortgage');renameSetting('meganR1','Megan Mortgage');renameSetting('meganR2','Megan Additional');const appearance=document.createElement('div');appearance.innerHTML='<p class="eyebrow" style="margin-top:22px">APPEARANCE</p><button class="button ghost" id="themeSettingsToggle"></button>';document.querySelector('#settings .panel.settings').append(appearance);const updateThemeButton=()=>themeSettingsToggle.textContent=document.documentElement.dataset.theme==='dark'?'Light mode':'Dark mode';updateThemeButton();themeSettingsToggle.onclick=()=>{document.getElementById('themeToggle').click();updateThemeButton()};
let chartRange='2',billMetric='water';function currentMonthKey(){const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`}function chartMonths(){const completed=data.months.filter(month=>month.id<=currentMonthKey());if(chartRange==='all')return completed;return completed.slice(-Number(chartRange)*12)}function chartSvg(values){if(!values.length)return '<div class="chart-empty">No monthly data yet.</div>';const width=480,height=160,pad=12,min=Math.min(0,...values),max=Math.max(0,...values),range=max-min||1,points=values.map((value,index)=>`${pad+(index*(width-pad*2)/Math.max(values.length-1,1))},${height-pad-((value-min)/range)*(height-pad*2)}`).join(' ');return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><line x1="${pad}" x2="${width-pad}" y1="${height-pad}" y2="${height-pad}" stroke="currentColor" opacity=".18"/><polyline points="${points}" fill="none" stroke="var(--orange)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></svg>`}function chartCard(title,values,extra=''){const latest=values.at(-1)||0;return `<article class="chart-card"><div class="chart-card-head"><h3>${title}</h3>${extra}</div><p class="chart-value">Latest: ${money(latest)}</p>${chartSvg(values)}</article>`}function renderCharts(){const months=chartMonths(),series={water:months.map(month=>month.water),electricity:months.map(month=>month.electricity),gas:months.map(month=>month.gas),food:months.map(month=>month.groceries),spending:months.map(month=>month.spending),savings:months.map(month=>total(month).saved)},rangeLabel=chartRange==='all'?'All time':`${chartRange} years`;chartArea.innerHTML=`<div class="chart-controls"><h2>Cost over time</h2><div class="chart-tabs">${[['2','2 yrs'],['5','5 yrs'],['all','All time']].map(([value,label])=>`<button class="${chartRange===value?'selected':''}" data-chart-range="${value}">${label}</button>`).join('')}</div></div><div class="chart-grid">${chartCard('Bills',series[billMetric],`<div class="bill-tabs">${[['water','Water'],['electricity','Electricity'],['gas','Gas']].map(([value,label])=>`<button class="${billMetric===value?'selected':''}" data-bill-series="${value}">${label}</button>`).join('')}</div>`)}${chartCard('Food',series.food)}${chartCard('Spending',series.spending)}${chartCard('Savings',series.savings)}</div><p class="small" style="margin-top:10px">${rangeLabel} · through ${months.at(-1)?.label||'today'}</p>`}const baseRender=render;render=()=>{const current=data.months.find(month=>month.id===currentMonthKey());if(current)active=current.id;baseRender();renderCharts()};document.addEventListener('click',event=>{const rangeButton=event.target.closest('[data-chart-range]');const billButton=event.target.closest('[data-bill-series]');if(rangeButton){chartRange=rangeButton.dataset.chartRange;renderCharts()}if(billButton){billMetric=billButton.dataset.billSeries;renderCharts()}});function renderHistory(){const sorted=[...data.entries].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));historyCount.textContent=`${sorted.length} expense${sorted.length===1?'':'s'}`;historyEntries.innerHTML=sorted.length?sorted.map(entry=>{const label=data.months.find(month=>month.id===entry.month)?.label||entry.month;return `<article class="history-entry"><span><small>Date</small><b>${new Date(entry.createdAt).toLocaleString()}</b></span><span><small>Month · Type</small><b>${label} · ${entry.type}</b></span><span><small>Amount · modifier · final</small><b>${money(entry.original)} × ${round(entry.modifier).toFixed(2)} = ${money(entry.final)}</b></span><span><small>Entry ID</small><b>${entry.id||'—'}</b></span>${entry.comment?`<span class="history-comment"><small>Comment</small>${escapeHtml(entry.comment)}</span>`:''}</article>`}).join(''):'<div class="chart-empty">Expenses you add will appear here.</div>'}const chartRender=render;render=()=>{chartRender();renderHistory()};render();
document.getElementById('closeExpense').onclick=()=>dialog.close();
function rollingAverage(points,window=3){return points.map((point,index)=>{const slice=points.slice(Math.max(0,index-window+1),index+1),average=slice.reduce((sum,item)=>sum+item.value,0)/slice.length;return {...point,average:round(average)}})}
function chartSvg(points,color){if(!points.length)return '<div class="chart-empty">No monthly data yet.</div>';const width=520,height=220,left=52,right=16,top=18,bottom=42,plotWidth=width-left-right,plotHeight=height-top-bottom,values=points.map(point=>point.average),min=Math.min(0,...values),max=Math.max(0,...values),range=max-min||1,x=index=>left+index*plotWidth/Math.max(points.length-1,1),y=value=>top+(max-value)*plotHeight/range,yTicks=[max,round((max+min)/2),min],xIndexes=[...new Set([0,Math.floor((points.length-1)/2),points.length-1])],path=points.map((point,index)=>`${index?'L':'M'} ${x(index).toFixed(1)} ${y(point.average).toFixed(1)}`).join(' ');return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Three-month rolling average chart">${yTicks.map(value=>`<g><line class="chart-grid-line" x1="${left}" x2="${width-right}" y1="${y(value)}" y2="${y(value)}"/><text class="chart-axis-label" x="${left-8}" y="${y(value)+4}" text-anchor="end">${money(value)}</text></g>`).join('')}<line class="chart-axis" x1="${left}" x2="${width-right}" y1="${height-bottom}" y2="${height-bottom}"/><path d="${path}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>${points.map((point,index)=>`<g><circle cx="${x(index)}" cy="${y(point.average)}" r="3.5" fill="${color}"/><circle class="chart-point" cx="${x(index)}" cy="${y(point.average)}" r="10" fill="${color}" fill-opacity=".001"><title>${point.label}: ${money(point.value)}\n3-month average: ${money(point.average)}</title></circle></g>`).join('')}${xIndexes.map(index=>`<g><line class="chart-axis" x1="${x(index)}" x2="${x(index)}" y1="${height-bottom}" y2="${height-bottom+5}"/><text class="chart-axis-label" x="${x(index)}" y="${height-15}" text-anchor="middle">${points[index].label.split(' ')[0].slice(0,3)} ${points[index].label.split(' ').at(-1)}</text></g>`).join('')}</svg>`}
function chartCard(title,points,color,extra=''){const smoothed=rollingAverage(points),latest=smoothed.at(-1);return `<article class="chart-card"><div class="chart-card-head"><div><h3>${title}</h3><p class="chart-subtitle">3-month rolling average</p></div>${extra}</div><p class="chart-value">Latest: ${money(latest?.value||0)}</p>${chartSvg(smoothed,color)}</article>`}
function renderCharts(){const months=chartMonths(),series={water:months.map(month=>({label:month.label,value:month.water})),electricity:months.map(month=>({label:month.label,value:month.electricity})),gas:months.map(month=>({label:month.label,value:month.gas})),food:months.map(month=>({label:month.label,value:month.groceries})),spending:months.map(month=>({label:month.label,value:month.spending})),savings:months.map(month=>({label:month.label,value:total(month).saved}))},rangeLabel=chartRange==='all'?'All time':`${chartRange} years`;chartArea.innerHTML=`<div class="chart-controls"><h2>Cost over time</h2><div class="chart-tabs">${[['2','2 yrs'],['5','5 yrs'],['all','All time']].map(([value,label])=>`<button class="${chartRange===value?'selected':''}" data-chart-range="${value}">${label}</button>`).join('')}</div></div><div class="chart-grid">${chartCard('Bills',series[billMetric],'#45b8b0',`<div class="bill-tabs">${[['water','Water'],['electricity','Electricity'],['gas','Gas']].map(([value,label])=>`<button class="${billMetric===value?'selected':''}" data-bill-series="${value}">${label}</button>`).join('')}</div>`)}${chartCard('Food',series.food,'#e2ad4c')}${chartCard('Spending',series.spending,'#f0845c')}${chartCard('Savings',series.savings,'#b28ad5')}</div><p class="small" style="margin-top:10px">${rangeLabel} · through ${months.at(-1)?.label||'today'}</p>`}
render();
function chartCard(title,points,color,extra=''){const palette={'#45b8b0':'#35b9b1','#e2ad4c':'#efb43b','#f0845c':'#4d96b7','#b28ad5':'#779fc2'},smoothed=rollingAverage(points),latest=smoothed.at(-1);return `<article class="chart-card"><div class="chart-card-head"><div><h3>${title}</h3><p class="chart-subtitle">3-month rolling average</p></div>${extra}</div><p class="chart-value">Latest: ${money(latest?.value||0)}</p>${chartSvg(smoothed,palette[color]||color)}</article>`}
let notesMonthId='';const notesDialog=document.getElementById('notesDialog'),notesText=document.getElementById('notesText'),notesCount=document.getElementById('notesCount');function updateNotesCount(){notesCount.textContent=`${notesText.value.length} / 500`}function appendExpenseCommentToNotes(month,entry){const item=`• ${money(entry.final)} — ${entry.comment}`,existing=String(month.notes||'').trim(),next=existing?`${existing}\n${item}`:item;if(next.length<=500){month.notes=next;return true}notice.textContent=`${money(entry.final)} added to spending, but its comment could not be added to Notes because that field is full.`;return false}function openNotes(monthId){const month=data.months.find(item=>item.id===monthId);if(!month)return;notesMonthId=monthId;document.getElementById('notesTitle').textContent=`Notes · ${month.label}`;notesText.value=String(month.notes||'').slice(0,500);updateNotesCount();notesDialog.showModal();notesText.focus()}notesText.oninput=()=>{if(notesText.value.length>500)notesText.value=notesText.value.slice(0,500);updateNotesCount()};document.addEventListener('click',event=>{const button=event.target.closest('[data-notes-month]');if(button)openNotes(button.dataset.notesMonth)});document.getElementById('cancelNotes').onclick=()=>notesDialog.close();document.getElementById('saveNotes').onclick=()=>{const month=data.months.find(item=>item.id===notesMonthId);if(!month)return;month.notes=notesText.value.trim().slice(0,500);save();syncMonth(month);notesDialog.close();render()};
function escapeHtml(value){return String(value).replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]))}
function monthTable(months){return `<div class="table-wrap"><table class="table monthly-table"><thead><tr><th>Month</th><th>Saved</th><th>Spending</th><th>Food</th><th>Water</th><th>Electricity</th><th>Gas</th><th>Megan owes</th><th aria-label="Actions"></th></tr></thead><tbody>${months.map(month=>{const values=total(month),label=`${monthLabels[Number(month.id.slice(5,7))-1].slice(0,3)} '${month.id.slice(2,4)}`;return `<tr><th>${label}</th><td class="saved">${money(values.saved)}</td><td><div class="spending-cell"><input type="number" data-month="${month.id}" data-key="spending" value="${round(month.spending)}"><button class="notes-button ${month.notes?'has-notes':''}" data-notes-month="${month.id}" aria-label="Edit notes for ${month.label}" title="${month.notes?'Edit notes':'Add notes'}">▤</button></div></td><td><input type="number" data-month="${month.id}" data-key="groceries" value="${round(month.groceries)}"></td>${['water','electricity','gas'].map(key=>`<td><input type="number" data-month="${month.id}" data-key="${key}" value="${round(month[key])}"></td>`).join('')}<td class="megan">${money(values.megan)}</td><td class="actions"><details><summary aria-label="More actions">•••</summary><div class="action-menu"><button data-offset-month="${month.id}">Add cash offset</button></div></details></td></tr>`}).join('')}</tbody></table></div>`}
function renderHistory(){const sorted=[...data.entries].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));historyCount.textContent=`${sorted.length} expense${sorted.length===1?'':'s'}`;historyEntries.innerHTML=sorted.length?sorted.map(entry=>{const label=data.months.find(month=>month.id===entry.month)?.label||entry.month;return `<article class="history-entry"><span><small>Date</small><b>${new Date(entry.createdAt).toLocaleString()}</b></span><span><small>Month · Type</small><b>${label} · ${entry.type}</b></span><span><small>Amount · modifier · final</small><b>${money(entry.original)} × ${round(entry.modifier).toFixed(2)} = ${money(entry.final)}</b></span>${entry.comment?`<span class="history-comment">${escapeHtml(entry.comment)}</span>`:''}</article>`}).join(''):'<div class="chart-empty">Expenses you add will appear here.</div>'}
function trendPoints(values){const count=values.length;if(count<2)return values.length?[values[0],values[0]]:[];const meanX=(count-1)/2,meanY=values.reduce((sum,value)=>sum+value,0)/count;let numerator=0,denominator=0;values.forEach((value,index)=>{numerator+=(index-meanX)*(value-meanY);denominator+=(index-meanX)**2});const slope=denominator?numerator/denominator:0,intercept=meanY-slope*meanX;return [intercept,intercept+slope*(count-1)]}
function chartSvg(points,color){if(!points.length)return '<div class="chart-empty">No monthly data yet.</div>';const width=520,height=220,left=52,right=16,top=18,bottom=42,plotWidth=width-left-right,plotHeight=height-top-bottom,values=points.map(point=>point.average),trend=trendPoints(values),min=Math.min(0,...values,...trend),max=Math.max(0,...values,...trend),range=max-min||1,x=index=>left+index*plotWidth/Math.max(points.length-1,1),y=value=>top+(max-value)*plotHeight/range,yTicks=[max,round((max+min)/2),min],xIndexes=[...new Set([0,Math.floor((points.length-1)/2),points.length-1])],path=points.map((point,index)=>`${index?'L':'M'} ${x(index).toFixed(1)} ${y(point.average).toFixed(1)}`).join(' '),trendPath=trend.length?`M ${x(0).toFixed(1)} ${y(trend[0]).toFixed(1)} L ${x(points.length-1).toFixed(1)} ${y(trend[1]).toFixed(1)}`:'';return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Three-month rolling average chart with trend line">${yTicks.map(value=>`<g><line class="chart-grid-line" x1="${left}" x2="${width-right}" y1="${y(value)}" y2="${y(value)}"/><text class="chart-axis-label" x="${left-8}" y="${y(value)+4}" text-anchor="end">${money(value)}</text></g>`).join('')}<line class="chart-axis" x1="${left}" x2="${width-right}" y1="${height-bottom}" y2="${height-bottom}"/><path d="${trendPath}" fill="none" stroke="${color}" stroke-opacity=".5" stroke-width="3" stroke-dasharray="7 6" stroke-linecap="round"/><path d="${path}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>${points.map((point,index)=>`<g><circle cx="${x(index)}" cy="${y(point.average)}" r="3.5" fill="${color}"/><circle class="chart-point" data-chart-label="${point.label}" data-chart-value="${money(point.value)}" data-chart-average="${money(point.average)}" cx="${x(index)}" cy="${y(point.average)}" r="13" fill="${color}" fill-opacity=".001"/></g>`).join('')}${xIndexes.map(index=>`<g><line class="chart-axis" x1="${x(index)}" x2="${x(index)}" y1="${height-bottom}" y2="${height-bottom+5}"/><text class="chart-axis-label" x="${x(index)}" y="${height-15}" text-anchor="middle">${points[index].label.split(' ')[0].slice(0,3)} ${points[index].label.split(' ').at(-1)}</text></g>`).join('')}</svg>`}
function savedTone(value){return value>4000?'saved-high':value>=2500?'saved-mid':value>0?'saved-low':'saved-negative'}
function monthTable(months){return `<div class="table-wrap"><table class="table monthly-table"><thead><tr><th>Month</th><th>Saved</th><th>Spending</th><th>Food</th><th>Water</th><th>Electricity</th><th>Gas</th><th>Megan owes</th><th aria-label="Actions"></th></tr></thead><tbody>${months.map(month=>{const values=total(month),label=`${monthLabels[Number(month.id.slice(5,7))-1].slice(0,3)} '${month.id.slice(2,4)}`;return `<tr data-month="${month.id}"><th>${label}</th><td class="saved ${savedTone(values.saved)}">${money(values.saved)}</td><td><div class="spending-cell"><span class="month-value">${money(month.spending)}</span><button class="notes-button ${month.notes?'has-notes':''}" data-notes-month="${month.id}" aria-label="Edit notes for ${month.label}" title="${month.notes?'Edit notes':'Add notes'}">▤</button></div></td><td class="month-value">${money(month.groceries)}</td>${['water','electricity','gas'].map(key=>`<td class="${utilityValueMissing(month,key)?'utility-missing':''}"><input type="number" inputmode="decimal" data-month="${month.id}" data-key="${key}" value="${round(month[key])}" aria-label="${key[0].toUpperCase()+key.slice(1)} for ${month.label}"></td>`).join('')}<td class="megan">${money(values.megan)}</td><td class="actions"><details><summary aria-label="More actions">•••</summary><div class="action-menu"><button data-offset-month="${month.id}">Add cash offset</button></div></details></td></tr>`}).join('')}</tbody></table></div>`}
const chartTooltip=document.createElement('div');chartTooltip.className='chart-tooltip';document.body.append(chartTooltip);function hideChartTooltip(){chartTooltip.classList.remove('visible')}function showChartTooltip(point,event){chartTooltip.innerHTML=`<b>${point.dataset.chartLabel}</b><span>${point.dataset.chartValue}</span><span>3-month average: ${point.dataset.chartAverage}</span>`;const gap=14,width=chartTooltip.offsetWidth,height=chartTooltip.offsetHeight,left=Math.min(window.innerWidth-width-10,Math.max(10,event.clientX+gap)),top=Math.min(window.innerHeight-height-10,Math.max(10,event.clientY-height-gap));chartTooltip.style.left=`${left}px`;chartTooltip.style.top=`${top}px`;chartTooltip.classList.add('visible')}document.addEventListener('pointermove',event=>{const point=event.target.closest?.('.chart-point');if(point)showChartTooltip(point,event);else hideChartTooltip()});document.addEventListener('pointerleave',hideChartTooltip);document.querySelectorAll('.tab').forEach(button=>button.onclick=()=>{document.querySelectorAll('.tab').forEach(item=>item.classList.remove('active'));document.querySelectorAll('.app > section').forEach(item=>item.classList.add('hidden'));button.classList.add('active');document.getElementById(button.dataset.tab).classList.remove('hidden');if(button.dataset.tab==='overview')renderCharts()});
function renderMonthlyTimeline(){const timeline=document.getElementById('yearTimeline'),today=new Date(),thisYear=today.getFullYear(),years=[...new Set(data.months.map(month=>month.id.slice(0,4)))].sort((a,b)=>Number(b)-Number(a));if(!timeline)return;timeline.innerHTML=years.map(year=>{const yearNumber=Number(year),months=data.months.filter(month=>month.id.startsWith(year)),included=yearNumber===thisYear?months.filter(month=>Number(month.id.slice(5,7))<today.getMonth()+1):months,totalSaved=Math.round(included.reduce((sum,month)=>sum+total(month).saved,0)),subline=yearNumber>thisYear?'':`${yearNumber===thisYear?'Saved so far':'Total saved'} ${money(totalSaved)}`;return `<button class="${year===selectedYear?'selected':''}" data-year-tab="${year}"><strong>${year}</strong>${subline?`<span>${subline}</span>`:''}</button>`}).join('')}
const timelineRender=render;render=()=>{timelineRender();renderMonthlyTimeline()};document.getElementById('closeNotes').onclick=()=>notesDialog.close();document.querySelectorAll('dialog').forEach(modal=>modal.addEventListener('click',event=>{if(event.target===modal)modal.close()}));
function applyDisplayMode(){document.documentElement.classList.toggle('display-mode',displayMode);document.querySelectorAll('input[type="number"],input[type="date"],input[data-display-original-type]').forEach(input=>{if(displayMode){if(input.dataset.displayOriginalType)return;input.dataset.displayOriginalType=input.type;input.dataset.displayRawValue=input.value;input.type='text';input.readOnly=true;input.value=maskDigits(input.value)}else if(input.dataset.displayOriginalType){const value=input.dataset.displayRawValue;input.type=input.dataset.displayOriginalType;input.value=value;input.readOnly=false;delete input.dataset.displayOriginalType;delete input.dataset.displayRawValue}});if(!displayMode)return;const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode(node){const parent=node.parentElement;return parent&&['SCRIPT','STYLE'].includes(parent.tagName)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT}});let node;while(node=walker.nextNode())node.nodeValue=maskDigits(node.nodeValue)}
const displayControl=document.createElement('label');displayControl.className='display-mode-control';displayControl.innerHTML='<span><b>Display Mode</b><small>Obscure numeric data on this device</small></span><span class="display-switch"><input id="displayModeToggle" type="checkbox" aria-label="Toggle Display Mode"><i></i></span>';document.querySelector('#settings .panel.settings').append(displayControl);const displayModeToggle=document.getElementById('displayModeToggle');displayModeToggle.checked=displayMode;displayModeToggle.onchange=()=>{displayMode=displayModeToggle.checked;localStorage.setItem('cream-corn-display-mode',displayMode?'on':'off');render()};const displayRender=render;render=()=>{displayRender();applyDisplayMode()};let deferredInstallPrompt=null;const installBanner=document.getElementById('installBanner');window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstallPrompt=event;installBanner.classList.remove('hidden')});document.getElementById('installApp').onclick=async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;installBanner.classList.add('hidden')};document.getElementById('dismissInstall').onclick=()=>installBanner.classList.add('hidden');window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;installBanner.classList.add('hidden')});render();
function normalizeIncomeLevels(){const settings=data.settings,legacyPaycheck=round(num(settings.monthlyIncome)*12/26),earliest=data.months.at(0)?.id||'';if(!Array.isArray(settings.incomeLevels)||!settings.incomeLevels.length)settings.incomeLevels=[{id:'legacy-income',start:earliest,end:'',paycheck:legacyPaycheck}];settings.incomeLevels=settings.incomeLevels.map((level,index)=>({id:level.id||`income-${index}`,start:String(level.start||''),end:String(level.end||''),paycheck:num(level.paycheck)}));const legacy=settings.incomeLevels.find(level=>level.id==='legacy-income');if(legacy&&earliest&&!legacy.start)legacy.start=earliest;if(!Number.isFinite(Number(settings.monthlyIncome)))settings.monthlyIncome=round(legacyPaycheck*26/12)}
function incomeLevelForMonth(monthId){normalizeIncomeLevels();return [...data.settings.incomeLevels].sort((a,b)=>String(b.start).localeCompare(String(a.start))).find(level=>(!level.start||level.start<=monthId)&&(!level.end||level.end>=monthId))}
function paycheckForMonth(month){if(Number.isFinite(Number(month.incomePaycheck)))return num(month.incomePaycheck);return num(incomeLevelForMonth(month.id)?.paycheck)||round(num(data.settings.monthlyIncome)*12/26)}
function monthlyIncomeForMonth(month){return round(paycheckForMonth(month)*26/12)}
function total(m){const s=data.settings,utilities=m.water+m.electricity+m.gas,kevinFood=m.groceries*s.foodShare/100,megan=m.groceries*(1-s.foodShare/100)+s.meganR1+s.meganR2,expenses=s.fixedExpenses+s.kevinMortgage+utilities+kevinFood-m.cashOffset;return{utilities,megan,expenses,income:monthlyIncomeForMonth(m),saved:monthlyIncomeForMonth(m)-expenses-m.spending}}
function lockCompletedIncomeMonths(){normalizeIncomeLevels();if(!data.settings.incomeHistoryLocked)return;const current=currentMonthKey(),changed=[];data.months.forEach(month=>{if(month.id<current&&!Number.isFinite(Number(month.incomePaycheck))){month.incomePaycheck=paycheckForMonth(month);changed.push(month)}});if(changed.length){save();changed.forEach(syncMonth)}}
function syncLegacyMonthlyIncome(){const current=data.months.find(month=>month.id===currentMonthKey())||data.months.at(-1);if(current)data.settings.monthlyIncome=monthlyIncomeForMonth(current)}
function setupIncomeHistory(){const legacyInput=document.querySelector('[data-setting="monthlyIncome"]'),legacyField=legacyInput?.closest('label');if(!legacyField||document.getElementById('incomeHistory'))return;const host=document.createElement('section');host.id='incomeHistory';host.className='income-history';legacyField.replaceWith(host);host.addEventListener('change',event=>{const field=event.target.closest('[data-income-field]');if(!field)return;const level=data.settings.incomeLevels.find(item=>item.id===field.dataset.incomeId);if(!level)return;level[field.dataset.incomeField]=field.dataset.incomeField==='paycheck'?num(field.value):field.value;syncLegacyMonthlyIncome();save();syncSettings();render()});host.addEventListener('click',event=>{const remove=event.target.closest('[data-remove-income]'),add=event.target.closest('#addIncomeLevel'),apply=event.target.closest('#applyIncomeHistory');if(remove){if(data.settings.incomeLevels.length===1)return;data.settings.incomeLevels=data.settings.incomeLevels.filter(level=>level.id!==remove.dataset.removeIncome);syncLegacyMonthlyIncome();save();syncSettings();render()}if(add){const current=currentMonthKey();data.settings.incomeLevels.push({id:`income-${Date.now()}`,start:current,end:'',paycheck:paycheckForMonth({id:current})});save();syncSettings();render()}if(apply){const current=currentMonthKey();data.months.forEach(month=>{if(month.id<current)month.incomePaycheck=paycheckForMonth({...month,incomePaycheck:undefined})});data.settings.incomeHistoryLocked=true;syncLegacyMonthlyIncome();save();syncSettings();data.months.filter(month=>month.id<current).forEach(syncMonth);render();const notice=document.querySelector('.income-history-notice');if(notice)notice.textContent='Completed months now use the income levels shown above.'}})}
function renderIncomeLevels(message=''){setupIncomeHistory();const host=document.getElementById('incomeHistory');if(!host)return;normalizeIncomeLevels();const levels=[...data.settings.incomeLevels].sort((a,b)=>String(a.start).localeCompare(String(b.start)));host.innerHTML=`<p class="eyebrow">INCOME HISTORY</p><h2>Kevin income levels</h2><p class="small">Enter the R7 biweekly paycheck amount. Cream Corn calculates each month as paycheck × 26 ÷ 12.</p><div class="income-level-head"><span>R7 paycheck</span><span>From</span><span>Through</span><span></span></div><div>${levels.map(level=>`<div class="income-level-row"><input type="number" inputmode="decimal" aria-label="R7 paycheck" data-income-field="paycheck" data-income-id="${level.id}" value="${round(level.paycheck)}"><input type="month" aria-label="Income level start month" data-income-field="start" data-income-id="${level.id}" value="${level.start}"><input type="month" aria-label="Income level end month" data-income-field="end" data-income-id="${level.id}" value="${level.end}"><button type="button" class="income-level-remove" data-remove-income="${level.id}" aria-label="Remove income level" ${levels.length===1?'disabled':''}>×</button></div>`).join('')}</div><div class="income-history-actions"><button type="button" class="button ghost" id="addIncomeLevel">+ Add income level</button><button type="button" class="button primary" id="applyIncomeHistory">Apply ranges to completed months</button></div><p class="income-history-notice">${message||'Completed months stay fixed after they are applied; future completed months lock automatically.'}</p>`}
function updateSavingsMetricLabels(){const labels=document.querySelectorAll('#metrics .metric p'),year=new Date().getFullYear();if(labels[2])labels[2].textContent=`${year} Monthly Savings`;if(labels[3])labels[3].textContent=`${year} Yearly Savings`}
const savingsLabelsRender=render;render=()=>{savingsLabelsRender();updateSavingsMetricLabels()};const incomeHistoryRender=render;render=()=>{normalizeIncomeLevels();lockCompletedIncomeMonths();incomeHistoryRender();renderIncomeLevels();if(displayMode)applyDisplayMode()};render();
document.querySelectorAll('.tab').forEach(button=>button.onclick=()=>{document.querySelectorAll('.tab').forEach(item=>item.classList.remove('active'));document.querySelectorAll('.app > section').forEach(section=>section.classList.add('hidden'));button.classList.add('active');document.getElementById(button.dataset.tab).classList.remove('hidden');if(button.dataset.tab==='overview'){renderCharts();updateSavingsMetricLabels();requestAnimationFrame(updateChartControlsSticky)}});
function updateChartControlsSticky(){const controls=document.querySelector('#overview .chart-controls');if(!controls)return;controls.classList.toggle('is-stuck',window.scrollY>0&&controls.getBoundingClientRect().top<=0)}
window.addEventListener('scroll',updateChartControlsSticky,{passive:true});window.addEventListener('resize',updateChartControlsSticky);
const stickyChartRender=renderCharts;renderCharts=()=>{stickyChartRender();requestAnimationFrame(updateChartControlsSticky)};requestAnimationFrame(updateChartControlsSticky);
function localDateKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function setupHistoryFilter(){const history=document.getElementById('history'),entries=document.getElementById('historyEntries');if(!history||document.getElementById('historyFilter'))return;const input=document.createElement('input');input.id='historyFilter';input.className='history-filter';input.type='search';input.placeholder='Filter comments';input.setAttribute('aria-label','Filter expense comments');input.addEventListener('input',()=>{historyFilter=input.value.trim().toLowerCase();renderHistory()});history.insertBefore(input,entries)}
function renderHistory(){setupHistoryFilter();const sorted=[...data.entries].filter(entry=>!historyFilter||String(entry.comment||'').toLowerCase().includes(historyFilter)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));historyCount.textContent=`${sorted.length} expense${sorted.length===1?'':'s'}`;historyEntries.innerHTML=sorted.length?sorted.map(entry=>{const created=new Date(entry.createdAt),label=data.months.find(month=>month.id===entry.month)?.label||entry.month,date=created.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),time=created.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}),editIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10.4-10.4a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z"/><path d="m13.9 7.2 3 3"/></svg>',deleteIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M9 7l.7-3h4.6L15 7m-8 0 1 13h8l1-13"/></svg>';return `<article class="history-entry"><span class="history-date"><b>${date}</b><time datetime="${created.toISOString()}">${time}</time></span><span class="history-kind"><b>${entry.type}</b><span>${label}</span></span><b class="history-final">${money(entry.final)}</b><div class="history-actions"><button type="button" class="history-icon-button" data-edit-expense="${entry.id}" aria-label="Edit expense">${editIcon}</button><button type="button" class="history-icon-button history-delete" data-delete-expense="${entry.id}" aria-label="Delete expense">${deleteIcon}</button></div>${entry.comment?`<p class="history-comment">${escapeHtml(entry.comment)}</p>`:''}</article>`}).join(''):'<div class="chart-empty">No matching expenses.</div>'}
const expenseEditDialog=document.createElement('dialog');expenseEditDialog.id='expenseEditDialog';expenseEditDialog.className='expense-edit-dialog';expenseEditDialog.innerHTML='<form class="dialog-inner" id="expenseEditForm"><button type="button" class="dialog-close" id="closeExpenseEdit" aria-label="Close expense editor">×</button><h2>Edit expense</h2><div class="dialog-grid"><label>Amount<input id="expenseEditAmount" type="number" inputmode="decimal" required></label><label>Modifier<input id="expenseEditModifier" type="number" min="0.90" max="1" step="0.01" required></label><label>Type<select id="expenseEditType"><option>Spending</option><option>Water</option><option>Electricity</option><option>Gas</option><option>Groceries</option></select></label><label>Month<select id="expenseEditMonth"></select></label><label class="full-row">Comment<textarea id="expenseEditComment" maxlength="500"></textarea></label></div><div class="toolbar modal-actions"><button type="button" class="button ghost" id="cancelExpenseEdit">Cancel</button><button type="submit" class="button primary">Save</button></div></form>';document.body.append(expenseEditDialog);let editingExpenseId='';const expenseEditAmount=document.getElementById('expenseEditAmount'),expenseEditModifier=document.getElementById('expenseEditModifier'),expenseEditType=document.getElementById('expenseEditType'),expenseEditMonth=document.getElementById('expenseEditMonth'),expenseEditComment=document.getElementById('expenseEditComment');function syncEditedExpense(entry){if(!firebaseClient||!firebaseUser)return;firebaseClient.setDoc(firebaseClient.doc(firebaseClient.db,...firebasePath('expenses'),entry.id),entry).catch(error=>{console.error(error);firebaseStatusMessage('Could not sync this expense yet. It remains saved on this device.')})}function deleteCloudExpense(id){if(!firebaseClient||!firebaseUser)return;firebaseClient.deleteDoc(firebaseClient.doc(firebaseClient.db,...firebasePath('expenses'),id)).catch(error=>{console.error(error);firebaseStatusMessage('Could not delete this expense from sync yet. It remains removed on this device.')})}function openExpenseEdit(id){const entry=data.entries.find(item=>item.id===id);if(!entry)return;editingExpenseId=id;expenseEditAmount.value=round(entry.original);expenseEditModifier.value=round(entry.modifier).toFixed(2);expenseEditType.value=entry.type;expenseEditMonth.innerHTML=data.months.map(month=>`<option value="${month.id}">${month.label}</option>`).join('');expenseEditMonth.value=entry.month;expenseEditComment.value=entry.comment||'';expenseEditDialog.showModal();expenseEditAmount.focus()}document.addEventListener('click',event=>{const edit=event.target.closest('[data-edit-expense]'),remove=event.target.closest('[data-delete-expense]');if(edit)openExpenseEdit(edit.dataset.editExpense);if(remove){const entry=data.entries.find(item=>item.id===remove.dataset.deleteExpense);if(!entry||!confirm('Delete this expense?'))return;const month=data.months.find(item=>item.id===entry.month);if(month)month[entry.type.toLowerCase()]=round(month[entry.type.toLowerCase()]-entry.final);data.entries=data.entries.filter(item=>item.id!==entry.id);save();if(month)syncMonth(month);deleteCloudExpense(entry.id);render()}});document.getElementById('closeExpenseEdit').onclick=()=>expenseEditDialog.close();document.getElementById('cancelExpenseEdit').onclick=()=>expenseEditDialog.close();expenseEditDialog.addEventListener('click',event=>{if(event.target===expenseEditDialog)expenseEditDialog.close()});document.getElementById('expenseEditForm').addEventListener('submit',event=>{event.preventDefault();const entry=data.entries.find(item=>item.id===editingExpenseId),original=num(expenseEditAmount.value),modifier=Math.max(.9,Math.min(1,num(expenseEditModifier.value))),type=expenseEditType.value,monthId=expenseEditMonth.value;if(!entry||original<=0)return;const oldMonth=data.months.find(item=>item.id===entry.month),newMonth=data.months.find(item=>item.id===monthId),oldKey=entry.type.toLowerCase(),newKey=type.toLowerCase(),final=round(original*modifier);if(oldMonth)oldMonth[oldKey]=round(oldMonth[oldKey]-entry.final);if(newMonth)newMonth[newKey]=round(newMonth[newKey]+final);Object.assign(entry,{original,modifier,type,month:monthId,final,comment:expenseEditComment.value.trim().slice(0,500),updatedAt:new Date().toISOString()});save();[...new Set([oldMonth,newMonth].filter(Boolean))].forEach(syncMonth);syncEditedExpense(entry);expenseEditDialog.close();render()});
const meganReminderDialog=document.createElement('dialog');meganReminderDialog.id='meganReminderDialog';meganReminderDialog.className='megan-reminder-dialog';meganReminderDialog.innerHTML='<div class="dialog-inner"><button class="dialog-close" id="closeMeganReminder" aria-label="Close reminder">×</button><h2>Megan owes</h2><p id="meganReminderText"></p><div class="toolbar" style="justify-content:flex-end;margin:18px 0 0"><button class="button primary" id="dismissMeganReminder">Got it</button></div></div>';document.body.append(meganReminderDialog);function maybeShowMeganReminder(){const now=new Date();if(now.getDate()!==1||meganReminderDialog.open)return;const current=currentMonthKey();if(data.settings.meganReminderSeen===current)return;const previous=new Date(now.getFullYear(),now.getMonth()-1,1),previousId=`${previous.getFullYear()}-${String(previous.getMonth()+1).padStart(2,'0')}`,month=data.months.find(item=>item.id===previousId);if(!month)return;document.getElementById('meganReminderText').textContent=`For ${month.label}, Megan owes ${money(total(month).megan)}.`;meganReminderDialog.showModal()}function dismissMeganReminder(){data.settings.meganReminderSeen=currentMonthKey();save();syncSettings();meganReminderDialog.close()}document.getElementById('closeMeganReminder').onclick=dismissMeganReminder;document.getElementById('dismissMeganReminder').onclick=dismissMeganReminder;meganReminderDialog.addEventListener('click',event=>{if(event.target===meganReminderDialog)dismissMeganReminder()});
function bytesToBase64(bytes){let binary='';bytes.forEach(byte=>binary+=String.fromCharCode(byte));return btoa(binary)}function base64ToBytes(value){return Uint8Array.from(atob(value),char=>char.charCodeAt(0))}async function backupKey(password,salt){const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:150000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}function setupBackupTools(){const panel=document.querySelector('#settings .panel.settings');if(!panel||document.getElementById('backupSection'))return;const section=document.createElement('section');section.id='backupSection';section.className='backup-section';section.innerHTML='<p class="eyebrow">BACKUP & RESTORE</p><h2>Your encrypted backup</h2><p class="small">Backups are password-protected and stay on your device until you choose where to save them.</p><div class="toolbar"><button class="button ghost" type="button" id="downloadBackup">Download backup</button><button class="button ghost" type="button" id="restoreBackup">Restore backup</button><input id="restoreBackupFile" type="file" accept="application/json,.json" class="hidden"></div>';panel.append(section);document.getElementById('downloadBackup').onclick=downloadBackup;document.getElementById('restoreBackup').onclick=()=>document.getElementById('restoreBackupFile').click();document.getElementById('restoreBackupFile').addEventListener('change',restoreBackup)}async function downloadBackup(){if(!crypto.subtle)return alert('This browser cannot create encrypted backups.');const password=prompt('Choose a password for this backup. You will need it to restore the file.');if(!password)return;const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await backupKey(password,salt),plain=new TextEncoder().encode(JSON.stringify({data,exportedAt:new Date().toISOString()})),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain),payload={format:'cream-corn-encrypted-backup',version:1,kdf:'PBKDF2-SHA-256',iterations:150000,salt:bytesToBase64(salt),iv:bytesToBase64(iv),ciphertext:bytesToBase64(new Uint8Array(cipher))},url=URL.createObjectURL(new Blob([JSON.stringify(payload)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=`cream-corn-backup-${localDateKey()}.json`;link.click();URL.revokeObjectURL(url)}async function restoreBackup(event){const file=event.target.files?.[0];event.target.value='';if(!file)return;try{const payload=JSON.parse(await file.text());let restored;if(payload.format==='cream-corn-encrypted-backup'){const password=prompt('Enter this backup’s password.');if(!password)return;const key=await backupKey(password,base64ToBytes(payload.salt)),plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:base64ToBytes(payload.iv)},key,base64ToBytes(payload.ciphertext));restored=JSON.parse(new TextDecoder().decode(plain)).data}else restored=payload.data;if(!restored?.months||!Array.isArray(restored.months)||!Array.isArray(restored.entries)||!confirm('Replace this device’s Cream Corn data with this backup?'))return;data=normalizeAppData(restored);ensureYear(currentYear);ensureYear(currentYear+1);data.months.sort((a,b)=>a.id.localeCompare(b.id));active=data.months.find(month=>month.id===currentMonthKey())?.id||data.months.at(-1).id;save();await syncSettings();await Promise.all(data.months.map(syncMonth));await Promise.all(data.entries.map(entry=>{entry.id=entry.id||crypto.randomUUID();return firebaseClient&&firebaseUser?firebaseClient.setDoc(firebaseClient.doc(firebaseClient.db,...firebasePath('expenses'),entry.id),entry):Promise.resolve()}));await Promise.all(data.extraIncome.map(syncExtraIncomeRecord));await Promise.all(data.investments.map(syncInvestmentRecord));render();alert('Backup restored.')}catch(error){console.error(error);alert('That backup could not be restored. Check the password and file.') }}
const backupReminderRender=render;render=()=>{backupReminderRender();setupBackupTools();maybeShowMeganReminder()};render();function utilityValueMissing(month,key){const now=new Date(),offset=key==='water'?-2:-1,cutoff=`${new Date(now.getFullYear(),now.getMonth()+offset,1).getFullYear()}-${String(new Date(now.getFullYear(),now.getMonth()+offset,1).padStart?new Date(now.getFullYear(),now.getMonth()+offset,1).getMonth()+1:new Date(now.getFullYear(),now.getMonth()+offset,1).getMonth()+1).padStart(2,'0')}`;return month.id<=cutoff&&num(month[key])===0}function renderUtilityAlert(){const alert=document.getElementById('utilityAlert');if(!alert)return;const names={water:'Water',electricity:'Electricity',gas:'Gas'},missing=['water','electricity','gas'].map(key=>[key,data.months.filter(month=>utilityValueMissing(month,key))]).filter(([,months])=>months.length);alert.classList.toggle('hidden',!missing.length);if(!missing.length){alert.textContent='';return}alert.textContent=`Utility values still needed — ${missing.map(([key,months])=>`${names[key]}: ${months.map(month=>`${monthLabels[Number(month.id.slice(5,7))-1].slice(0,3)} '${month.id.slice(2,4)}`).join(', ')}`).join(' · ')}`};const utilityAlertRender=render;render=()=>{utilityAlertRender();renderUtilityAlert()};async function addCloudExpense(entry,keyName,notes){if(!firebaseClient||!firebaseUser)return;const monthRef=firebaseClient.doc(firebaseClient.db,...firebasePath('months'),entry.month),entryRef=firebaseClient.doc(firebaseClient.db,...firebasePath('expenses'),entry.id);try{await firebaseClient.runTransaction(firebaseClient.db,async transaction=>{const snapshot=await transaction.get(monthRef),remote=cleanMonth(snapshot.exists()?snapshot.data():freshMonth(entry.month));remote[keyName]=round(remote[keyName]+entry.final);if(notes!==undefined)remote.notes=notes;transaction.set(monthRef,{...remote,updatedAt:new Date().toISOString()})});await firebaseClient.setDoc(entryRef,entry)}catch(error){console.error(error);firebaseStatusMessage('Could not sync this expense yet. It remains saved on this device.')}}saveExpense.onclick=()=>{const original=num(expenseAmount.value),modifier=Math.max(.9,Math.min(1,num(expenseModifier.value)));if(original<=0)return notice.textContent='Enter a positive expense amount.';const final=round(original*modifier),type=expenseType.value,keyName=type.toLowerCase(),comment=type==='Spending'?expenseComment.value.trim():'',entry={id:crypto.randomUUID(),type,month:expenseMonth.value,original,modifier,final,comment,createdAt:new Date().toISOString()},month=data.months.find(item=>item.id===entry.month);month[keyName]=round(month[keyName]+final);const notesChanged=original>200&&comment?appendExpenseCommentToNotes(month,entry):false;data.entries.unshift(entry);addCloudExpense(entry,keyName,notesChanged?month.notes:undefined);active=entry.month;save();dialog.close();expenseAmount.value='';expenseComment.value='';notice.textContent=money(final)+' added to '+type.toLowerCase()+'.';render()};render();

  // Months fields accept calculator-style input while keeping their stored value numeric.
  function resolveMonthExpression(raw) {
    const expression = String(raw ?? '').trim().replaceAll(',', '');
    if (!expression) return 0;
    if (!/^[0-9+\-*/().\s]+$/.test(expression)) return null;
    try {
      const value = Function(`"use strict"; return (${expression})`)();
      return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
    } catch (_) {
      return null;
    }
  }

  document.addEventListener('focusin', event => {
    const field = event.target;
    if (!field?.dataset?.month || field.tagName !== 'INPUT') return;
    field.dataset.originalValue = field.value;
    field.type = 'text';
    field.inputMode = 'decimal';
  }, true);

  // This capture-phase handler replaces the older numeric-only change handler.
  document.addEventListener('change', event => {
    const field = event.target;
    if (!field?.dataset?.month) return;
    event.stopImmediatePropagation();
    const value = resolveMonthExpression(field.value);
    if (value === null) {
      field.value = field.dataset.originalValue ?? '';
      return;
    }
    const month = data.months.find(item => item.id === field.dataset.month);
    if (!month) return;
    month[field.dataset.key] = value;
    save();
    syncMonth(month);
    render();
  }, true);

  function utilityValueMissing(month, key) {
    const now = new Date();
    const cutoffDate = new Date(now.getFullYear(), now.getMonth() + (key === 'water' ? -2 : -1), 1);
    const cutoff = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}`;
    return month.id <= cutoff && num(month[key]) === 0;
  }

  (() => {
    const addDialog = document.getElementById('expenseDialog');
    const expenseGrid = addDialog.querySelector('.dialog-grid');
    const amount = document.getElementById('expenseAmount');
    const storedType = document.getElementById('expenseType');
    const modifier = document.getElementById('expenseModifier');
    const month = document.getElementById('expenseMonth');
    const comment = document.getElementById('expenseComment');
    const final = document.getElementById('finalAmount');
    const oldFinal = final.closest('.final');
    const oldComment = document.getElementById('commentField');

    let category = 'Shopping';
    let subcategory = 'Entertainment';

    const amountLabel = document.createElement('label');
    amountLabel.className = 'expense-amount-field';
    amountLabel.append('Amount', amount);
    const finalLabel = document.createElement('label');
    finalLabel.className = 'expense-final-field';
    finalLabel.append('Final amount', final);
    const typeLabel = document.createElement('label');
    typeLabel.className = 'full-row';
    typeLabel.innerHTML = '<span>Type</span><div class="option-grid expense-category-options" id="expenseCategoryOptions"><button type="button" class="choice-option" data-category="Groceries">Groceries</button><button type="button" class="choice-option" data-category="Dining">Dining</button><button type="button" class="choice-option selected" data-category="Shopping">Shopping</button></div><div class="expense-suboptions" id="shoppingSuboptions"><span>Shopping type</span><div class="option-grid shopping-suboptions"><button type="button" class="choice-option selected" data-shopping="Entertainment">Entertainment</button><button type="button" class="choice-option" data-shopping="Travel">Travel</button><button type="button" class="choice-option" data-shopping="Health">Health</button><button type="button" class="choice-option" data-shopping="Pets">Pets</button><button type="button" class="choice-option" data-shopping="Misc">Misc</button></div></div>';
    typeLabel.append(storedType);

    const modifierLabel = document.createElement('label');
    modifierLabel.className = 'full-row';
    modifierLabel.innerHTML = '<span>CC modifier</span><div class="option-grid modifier-grid" id="newModifierOptions"><button type="button" class="choice-option" data-new-modifier="0.94">94%</button><button type="button" class="choice-option selected" data-new-modifier="0.95">95%</button><button type="button" class="choice-option" data-new-modifier="0.97">97%</button><button type="button" class="choice-option" data-new-modifier="0.98">98%</button><button type="button" class="choice-option" data-new-modifier="0.99">99%</button><button type="button" class="choice-option" data-new-modifier="1">100%</button></div>';
    modifierLabel.append(modifier);
    oldComment.classList.add('full-row');
    expenseGrid.replaceChildren(amountLabel, finalLabel, typeLabel, modifierLabel, month.closest('label'), oldComment);
    oldFinal?.remove();

    const updateFinal = () => { final.textContent = money(num(amount.value) * Math.max(.9, Math.min(1, num(modifier.value)))); };
    const updateType = () => {
      const shopping = document.getElementById('shoppingSuboptions');
      shopping.classList.toggle('hidden', category !== 'Shopping');
      storedType.value = category === 'Groceries' ? 'Groceries' : 'Spending';
      oldComment.classList.toggle('hidden', storedType.value !== 'Spending');
    };
    document.getElementById('expenseCategoryOptions').addEventListener('click', event => {
      const choice = event.target.closest('[data-category]');
      if (!choice) return;
      category = choice.dataset.category;
      if (category === 'Shopping') subcategory = 'Entertainment';
      document.querySelectorAll('[data-category]').forEach(button => button.classList.toggle('selected', button === choice));
      document.querySelectorAll('[data-shopping]').forEach((button, index) => button.classList.toggle('selected', index === 0));
      modifier.value = category === 'Dining' ? '0.97' : '0.95';
      document.querySelectorAll('[data-new-modifier]').forEach(button => button.classList.toggle('selected', button.dataset.newModifier === modifier.value));
      updateType();
      updateFinal();
    });
    document.getElementById('shoppingSuboptions').addEventListener('click', event => {
      const choice = event.target.closest('[data-shopping]');
      if (!choice) return;
      subcategory = choice.dataset.shopping;
      document.querySelectorAll('[data-shopping]').forEach(button => button.classList.toggle('selected', button === choice));
    });
    document.getElementById('newModifierOptions').addEventListener('click', event => {
      const choice = event.target.closest('[data-new-modifier]');
      if (!choice) return;
      modifier.value = choice.dataset.newModifier;
      document.querySelectorAll('[data-new-modifier]').forEach(button => button.classList.toggle('selected', button === choice));
      updateFinal();
    });
    amount.addEventListener('input', updateFinal);
    updateType();
    updateFinal();

    saveExpense.onclick = () => {
      const original = num(amount.value);
      const appliedModifier = Math.max(.9, Math.min(1, num(modifier.value)));
      if (original <= 0) return notice.textContent = 'Enter a positive expense amount.';
      const finalAmount = round(original * appliedModifier);
      const type = storedType.value;
      const keyName = type.toLowerCase();
      const entryComment = type === 'Spending' ? comment.value.trim() : '';
      const entry = { id: crypto.randomUUID(), type, category, subcategory: category === 'Groceries' || category === 'Dining' ? '' : subcategory, month: month.value, original, modifier: appliedModifier, final: finalAmount, comment: entryComment, createdAt: new Date().toISOString() };
      const targetMonth = data.months.find(item => item.id === entry.month);
      targetMonth[keyName] = round(targetMonth[keyName] + finalAmount);
      const notesChanged = original > 200 && entryComment ? appendExpenseCommentToNotes(targetMonth, entry) : false;
      data.entries.unshift(entry);
      addCloudExpense(entry, keyName, notesChanged ? targetMonth.notes : undefined);
      active = entry.month;
      save();
      addDialog.close();
      amount.value = '';
      comment.value = '';
      notice.textContent = money(finalAmount) + ' added to ' + category.toLowerCase() + '.';
      render();
    };
  })();

  (() => {
    const categoryBarColors = {
      expenses: '#35b9b1',
      groceries: '#efb43b',
      dining: '#78b575',
      spending: '#4d96b7'
    };

    function categoryBarMonths() {
      return data.months
        .filter(month => month.id <= currentMonthKey())
        .slice(-12)
        .map(month => {
          const dining = round(data.entries
            .filter(entry => entry.month === month.id && entry.category === 'Shopping' && entry.subcategory === 'Dining')
            .reduce((sum, entry) => sum + num(entry.final), 0));
          return {
            ...month,
            expenses: round(Math.max(0, num(data.settings.fixedExpenses) + num(data.settings.kevinMortgage) + num(month.water) + num(month.electricity) + num(month.gas) - num(month.cashOffset))),
            groceries: num(month.groceries),
            dining,
            spendingOther: round(Math.max(0, num(month.spending) - dining))
          };
        });
    }

    function categoryBarsSvg(months) {
      if (!months.length) return '<div class="chart-empty">No monthly data yet.</div>';
      const width = 1040, height = 360, left = 58, right = 20, top = 22, bottom = 56;
      const plotWidth = width - left - right, plotHeight = height - top - bottom;
      const maxValue = Math.max(1, ...months.flatMap(month => [month.expenses, month.groceries + month.dining, month.spendingOther]));
      const tickStep = Math.max(100, Math.ceil(maxValue / 4 / 100) * 100);
      const topTick = tickStep * 4;
      const y = value => top + plotHeight - value / topTick * plotHeight;
      const groupWidth = plotWidth / months.length;
      const barWidth = Math.min(20, Math.max(10, groupWidth * .22));
      const foodGap = 2;
      const monthLabel = month => `${monthLabels[Number(month.id.slice(5, 7)) - 1].slice(0, 3)} '${month.id.slice(2, 4)}`;
      const bars = months.map((month, index) => {
        const center = left + groupWidth * index + groupWidth / 2;
        const expenseX = center - barWidth * 1.65;
        const foodX = center - barWidth / 2;
        const spendingX = center + barWidth * .65;
        const expenseHeight = Math.max(0, top + plotHeight - y(month.expenses));
        const groceryHeight = Math.max(0, top + plotHeight - y(month.groceries));
        const diningHeight = Math.max(0, top + plotHeight - y(month.dining));
        const spendingHeight = Math.max(0, top + plotHeight - y(month.spendingOther));
        const diningY = y(month.groceries + month.dining);
        const groceryY = y(month.groceries);
        const diningBarHeight = Math.max(0, diningHeight - (month.dining && month.groceries ? foodGap : 0));
        return `<g class="category-bar-group"><rect class="category-bar" x="${expenseX}" y="${y(month.expenses)}" width="${barWidth}" height="${expenseHeight}" fill="${categoryBarColors.expenses}"><title>${month.label}\nExpenses: ${money(month.expenses)}</title></rect><rect class="category-bar" x="${foodX}" y="${groceryY}" width="${barWidth}" height="${groceryHeight}" fill="${categoryBarColors.groceries}"><title>${month.label}\nGroceries: ${money(month.groceries)}</title></rect>${month.dining ? `<rect class="category-bar" x="${foodX}" y="${diningY}" width="${barWidth}" height="${diningBarHeight}" fill="${categoryBarColors.dining}"><title>${month.label}\nDining: ${money(month.dining)}</title></rect>` : ''}<rect class="category-bar" x="${spendingX}" y="${y(month.spendingOther)}" width="${barWidth}" height="${spendingHeight}" fill="${categoryBarColors.spending}"><title>${month.label}\nSpending: ${money(month.spendingOther)}</title></rect><text class="chart-axis-label category-bar-month" x="${center}" y="${height - 20}" text-anchor="middle">${monthLabel(month)}</text></g>`;
      }).join('');
      const ticks = [0, 1, 2, 3, 4].map(index => {
        const value = tickStep * index;
        return `<g><line class="chart-grid-line" x1="${left}" x2="${width - right}" y1="${y(value)}" y2="${y(value)}"/><text class="chart-axis-label" x="${left - 10}" y="${y(value) + 4}" text-anchor="end">${money(value)}</text></g>`;
      }).join('');
      return `<div class="category-bar-viewport"><svg class="category-bar-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly spending by category, with expenses, dining and groceries, and other spending">${ticks}<line class="chart-axis" x1="${left}" x2="${width - right}" y1="${top + plotHeight}" y2="${top + plotHeight}"/>${bars}</svg></div>`;
    }

    function renderCategoryBars() {
      const oldChart = document.getElementById('categoryBarsChart');
      oldChart?.remove();
      const months = categoryBarMonths();
      const chart = document.createElement('article');
      chart.id = 'categoryBarsChart';
      chart.className = 'chart-card category-bars-chart';
      chart.innerHTML = `<div class="chart-card-head"><div><h3>Spending by category</h3><p class="chart-subtitle">Last 12 months</p></div></div>${categoryBarsSvg(months)}<div class="category-bar-legend"><span><i style="background:${categoryBarColors.expenses}"></i>Expenses</span><span><i style="background:${categoryBarColors.groceries}"></i>Groceries</span><span><i style="background:${categoryBarColors.dining}"></i>Dining</span><span><i style="background:${categoryBarColors.spending}"></i>Spending</span></div>`;
      chartArea.append(chart);
    }

    const baseCategoryBarsRender = renderCharts;
    renderCharts = () => { baseCategoryBarsRender(); renderCategoryBars(); };
    renderCharts();
  })();

  (() => {
    const uiIcons = {
      edit: '<svg viewBox="0 0 18 18" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M13.1439.768845C14.169-.256282 15.8311-.256282 16.8562.768845c1.0251 1.025125 1.0251 2.687185 0 3.712305L5.96405 15.3733c-.38306.3831-.83782.6869-1.33832.8942l-3.0702 1.2716c-.42039.1742-.90427.0779-1.22601-.2439-.321739-.3217-.41798-.8056-.243842-1.226l1.271642-3.0698c.2073-.5004.51113-.9551.89415-1.3381L13.1439.768845Z" fill="currentColor"/></svg>',
      trash: '<svg viewBox="0 0 19 22" fill="none" aria-hidden="true"><path d="m11.9904 7.75-.3462 9m-4.7884 0-.34615-9M2.02235 4.54057c1.14643-.17313 2.30614-.30572 3.47765-.39625C6.73744 4.0487 7.98803 4 9.25 4s2.512.0487 3.75.14432c1.1715.09053 2.3312.22312 3.4776.39625.342.05164.6828.1069 1.0224.16572m-1.0224-.33144-1.0678 13.88203C15.3196 19.5948 14.3421 20.5 13.1664 20.5H5.33357c-1.17571 0-2.1532-.9052-2.24337-2.0774L2.02235 4.54057M1 4.70629c.33957-.05882.68037-.11408 1.02235-.16572M13 4.14432v-.91613c0-1.17937-.9107-2.16396-2.0894-2.20167C10.3592 1.00889 9.80565 1 9.25 1c-.55565 0-1.10922.00889-1.66058.02652C6.41065 1.06423 5.5 2.04882 5.5 3.22819v.91613" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      overview: '<svg viewBox="0 0 21 20" aria-hidden="true"><path d="M9.96967 1.71967c.29293-.29289.76773-.29289 1.06063 0l8.6894 8.68933c.2929.2929.7677.2929 1.0606 0 .2929-.2929.2929-.76776 0-1.06065L12.091.659009c-.8787-.87868-2.30331-.87868-3.18199.000001L.21967 9.34835c-.292893.29289-.292893.76775 0 1.06065.292893.2929.767767.2929 1.06066 0l8.68934-8.68933Z" fill="currentColor"/><path d="m10.5 3.31066 8.159 8.15904c.0297.0297.0601.0584.091.0861v6.1979c0 1.0355-.8395 1.875-1.875 1.875H13.5c-.4142 0-.75-.3358-.75-.75v-4.5c0-.4142-.3358-.75-.75-.75H9c-.41421 0-.75.3358-.75.75v4.5c0 .4142-.33579.75-.75.75H4.125c-1.03553 0-1.875-.8395-1.875-1.875v-6.1979c.03093-.0277.06127-.0564.09099-.0861L10.5 3.31066Z" fill="currentColor"/></svg>',
      months: '<svg viewBox="0 0 20 20" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M4.5 0c.41421 0 .75.335786.75.75v1.5h9V.75C14.25.335786 14.5858 0 15 0s.75.335786.75.75v1.5h.75c1.6569 0 3 1.34315 3 3V16.5c0 1.6569-1.3431 3-3 3H3c-1.65685 0-3-1.3431-3-3V5.25c0-1.65685 1.34315-3 3-3h.75V.75C3.75.335786 4.08579 0 4.5 0ZM18 9c0-.82843-.6716-1.5-1.5-1.5H3c-.82843 0-1.5.67157-1.5 1.5v7.5c0 .8284.67157 1.5 1.5 1.5h13.5c.8284 0 1.5-.6716 1.5-1.5V9Z" fill="currentColor"/></svg>',
      history: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 4v6h4.5M19 10c0 4.9706-4.0294 9-9 9s-9-4.0294-9-9 4.0294-9 9-9 9 4.0294 9 9Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      settings: '<svg viewBox="0 0 28 28" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.9132 0c-.5172 0-.9491.394386-.9959.909465l-.3071 3.377875c-.9831.24107-1.9091.6275-2.7539 1.13521L5.92316 2.97826c-.39733-.33111-.98158-.30461-1.3473.06111L3.03892 4.57632c-.36572.36571-.39222.94996-.06112 1.34729l2.4444 2.93328c-.50754.84467-.89385 1.77051-1.13486 2.75331l-3.377875.3071C.394386 11.9641 0 12.396 0 12.9132v2.1736c0 .5172.394385.9491.909464.9959l3.377876.3071c.24107.9831.6275 1.9091 1.13521 2.7539l-2.4444 2.9331c-.33111.3974-.30461.9816.06111 1.3473l1.53695 1.537c.36572.3657.94996.3922 1.34729.0611l2.93328-2.4444c.84467.5075 1.77051.8938 2.75331 1.1349l.3071 3.3778c.0468.5151.4787.9095.9959.9095h2.1736c.5172 0 .9491-.3944.9959-.9095l.3071-3.3778c.9828-.2411 1.9086-.6274 2.7533-1.1349l2.9333 2.4444c.3973.3311.9816.3046 1.3473-.0611l1.5369-1.537c.3657-.3657.3922-.9499.0611-1.3473l-2.4443-2.9331c.5078-.8448.8942-1.7708 1.1353-2.7539l3.3778-.3071c.5151-.0468.9095-.4787.9095-.9959v-2.1736c0-.5172-.3944-.9491-.9095-.9959l-3.3778-.3071c-.2411-.9828-.6275-1.90864-1.1353-2.75331l2.4443-2.93328c.3311-.39733.3046-.98158-.0611-1.34729l-1.5369-1.53695c-.3657-.36572-.95-.39222-1.3473-.06111l-2.9333 2.44429c-.8447-.50771-1.7705-.89414-2.7533-1.13521l-.3071-3.377875C16.0359.394385 15.604 0 15.0868 0h-2.1736ZM14 10c-2.2091 0-4 1.7909-4 4s1.7909 4 4 4 4-1.7909 4-4-1.7909-4-4-4Z" fill="currentColor"/></svg>',
      notes: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M14 9.87831V1.5C14 .671562 13.3284 0 12.5 0h-11C.671562 0 0 .671562 0 1.5v10.9996c0 .8285.671562 1.5 1.5 1.5h8.37869c.39781 0 .77931-.158 1.06061-.4393l2.6214-2.6213C13.842 10.6577 14 10.2761 14 9.87831ZM10 12.3783V9.99963h2.3787L10 12.3783ZM12.5 1.5v6.99963H9.25c-.41422 0-.75.33578-.75.75v3.24997H1.5V1.5h11Z" fill="currentColor"/></svg>'
    };

    function applySvgIcons() {
      document.querySelectorAll('.nav-tab').forEach(tab => {
        const icon = tab.querySelector('.nav-icon');
        if (icon && uiIcons[tab.dataset.tab]) icon.innerHTML = uiIcons[tab.dataset.tab];
      });
      document.querySelectorAll('.notes-button').forEach(button => { button.innerHTML = uiIcons.notes; });
      document.querySelectorAll('.history-icon-button[data-edit-expense]').forEach(button => { button.innerHTML = uiIcons.edit; });
      document.querySelectorAll('.history-icon-button[data-delete-expense]').forEach(button => { button.innerHTML = uiIcons.trash; });
    }

    const iconsHistoryRender = renderHistory;
    renderHistory = () => { iconsHistoryRender(); applySvgIcons(); };
    const iconsRender = render;
    render = () => { iconsRender(); applySvgIcons(); };
    applySvgIcons();
  })();

  // Estuary intentionally runs without a service worker. Remove any worker
  // registered by an older release so future loads always use the network.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(registrations => Promise.all(registrations.map(registration => registration.unregister())));
  }

  (() => {
    const notesSvg = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M14 9.87831V1.5C14 .671562 13.3284 0 12.5 0h-11C.671562 0 0 .671562 0 1.5v10.9996c0 .8285.671562 1.5 1.5 1.5h8.37869c.39781 0 .77931-.158 1.06061-.4393l2.6214-2.6213C13.842 10.6577 14 10.2761 14 9.87831ZM10 12.3783V9.99963h2.3787L10 12.3783ZM12.5 1.5v6.99963H9.25c-.41422 0-.75.33578-.75.75v3.24997H1.5V1.5h11Z" fill="currentColor"/></svg>';
    const applyMonthNotesIcons = () => {
      document.querySelectorAll('.monthly-table .notes-button').forEach(button => {
        if (button.dataset.notesSvgApplied) return;
        button.innerHTML = notesSvg;
        button.dataset.notesSvgApplied = 'true';
      });
    };

    // Capture this before any legacy handlers so the Notes modal always opens.
    document.addEventListener('click', event => {
      const button = event.target.closest?.('.monthly-table [data-notes-month]');
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openNotes(button.dataset.notesMonth);
    }, true);

    const monthsSection = document.getElementById('months');
    if (monthsSection) {
      new MutationObserver(applyMonthNotesIcons).observe(monthsSection, { childList: true, subtree: true });
    }
    applyMonthNotesIcons();
  })();

  (() => {
    const removeLabelText = field => {
      if (!field) return;
      [...field.childNodes]
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .forEach(node => node.remove());
    };
    const amountField = document.querySelector('#expenseDialog .expense-amount-field');
    const finalField = document.querySelector('#expenseDialog .expense-final-field');
    const typeField = document.getElementById('expenseCategoryOptions')?.closest('label');
    const monthField = document.getElementById('expenseMonth')?.closest('label');
    const commentField = document.getElementById('commentField');
    removeLabelText(amountField);
    removeLabelText(monthField);
    removeLabelText(commentField);
    typeField?.querySelector(':scope > span')?.remove();
    document.querySelector('#shoppingSuboptions > span')?.remove();
    const amount = document.getElementById('expenseAmount');
    if (amount) {
      amount.placeholder = '0.00';
      amount.setAttribute('aria-label', 'Amount');
    }
    if (finalField) {
      const text = [...finalField.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
      if (text) text.nodeValue = 'Final amount';
    }
  })();

  (() => {
    const historyEditIcon = '<svg viewBox="0 0 21 21" aria-hidden="true"><path d="M20.2312.768845c-1.0252-1.025127-2.6872-1.025127-3.7123 0L15.3617 1.926 19.074 5.63831l1.1572-1.15715c1.0251-1.02513 1.0251-2.68719 0-3.712315Z" fill="currentColor"/><path d="m18.0134 6.69897-3.7124-3.71231L2.15021 15.1375c-.61679.6168-1.07018 1.3775-1.319198 2.2135l-.79978 2.6849c-.07862.2639-.00627.5497.188456.7444.19473.1948.48052.2671.74445.1885l2.68489-.7998c.83597-.249 1.59672-.7024 2.21351-1.3192L18.0134 6.69897Z" fill="currentColor"/></svg>';
    const historyRenderWithNewIcon = renderHistory;
    renderHistory = () => {
      historyRenderWithNewIcon();
      document.querySelectorAll('.history-icon-button[data-edit-expense]').forEach(button => { button.innerHTML = historyEditIcon; });
    };

    const editDialog = document.getElementById('expenseEditDialog');
    if (!editDialog) return;
    editDialog.innerHTML = `<form class="dialog-inner" id="expenseEditForm"><button type="button" class="dialog-close" id="closeExpenseEdit" aria-label="Close expense editor">×</button><h2>Edit expense</h2><div class="dialog-grid"><label class="expense-amount-field"><input id="expenseEditAmount" inputmode="decimal" placeholder="0.00" aria-label="Amount" required></label><label class="expense-final-field">Final amount<strong id="expenseEditFinal">$0.00</strong></label><label class="full-row"><div class="option-grid expense-category-options" id="expenseEditCategoryOptions"><button type="button" class="choice-option" data-edit-category="Groceries">Groceries</button><button type="button" class="choice-option" data-edit-category="Dining">Dining</button><button type="button" class="choice-option" data-edit-category="Shopping">Shopping</button><button type="button" class="choice-option" data-edit-category="Bills">Bills</button></div><div class="expense-suboptions hidden" id="expenseEditBillSuboptions"><span>Bill type</span><div class="option-grid"><button type="button" class="choice-option" data-edit-bill="Water">Water</button><button type="button" class="choice-option" data-edit-bill="Electricity">Electricity</button><button type="button" class="choice-option" data-edit-bill="Gas">Gas</button></div></div><div class="expense-suboptions" id="expenseEditShoppingSuboptions"><div class="option-grid shopping-suboptions"><button type="button" class="choice-option" data-edit-shopping="Entertainment">Entertainment</button><button type="button" class="choice-option" data-edit-shopping="Travel">Travel</button><button type="button" class="choice-option" data-edit-shopping="Health">Health</button><button type="button" class="choice-option" data-edit-shopping="Pets">Pets</button><button type="button" class="choice-option" data-edit-shopping="Misc">Misc</button></div></div><input id="expenseEditType" type="hidden"></label><label class="full-row"><span>CC modifier</span><div class="option-grid modifier-grid" id="expenseEditModifierOptions"><button type="button" class="choice-option" data-edit-modifier="0.94">94%</button><button type="button" class="choice-option" data-edit-modifier="0.95">95%</button><button type="button" class="choice-option" data-edit-modifier="0.97">97%</button><button type="button" class="choice-option" data-edit-modifier="0.98">98%</button><button type="button" class="choice-option" data-edit-modifier="0.99">99%</button><button type="button" class="choice-option" data-edit-modifier="1">100%</button></div><input id="expenseEditModifier" type="hidden"></label><label><select id="expenseEditMonth" aria-label="Month"></select></label><label class="full-row" id="expenseEditCommentField"><textarea id="expenseEditComment" maxlength="500" placeholder="What was this for?"></textarea></label></div><div class="toolbar modal-actions"><button type="button" class="button ghost" id="cancelExpenseEdit">Cancel</button><button type="submit" class="button primary">Edit expense</button></div></form>`;

    const form = document.getElementById('expenseEditForm');
    const amount = document.getElementById('expenseEditAmount');
    const modifier = document.getElementById('expenseEditModifier');
    const type = document.getElementById('expenseEditType');
    const month = document.getElementById('expenseEditMonth');
    const comment = document.getElementById('expenseEditComment');
    const final = document.getElementById('expenseEditFinal');
    const commentField = document.getElementById('expenseEditCommentField');
    let editingId = '';
    let category = 'Shopping';
    let subcategory = 'Entertainment';

    const autosize = field => { field.style.height = '48px'; field.style.height = `${Math.max(48, field.scrollHeight)}px`; };
    const updateFinal = () => { final.textContent = money(num(amount.value) * Math.max(.9, Math.min(1, num(modifier.value)))); };
    const updateType = () => {
      document.getElementById('expenseEditBillSuboptions').classList.toggle('hidden', category !== 'Bills');
      document.getElementById('expenseEditShoppingSuboptions').classList.toggle('hidden', category !== 'Shopping');
      type.value = category === 'Groceries' ? 'Groceries' : category === 'Bills' ? subcategory : 'Spending';
      commentField.classList.toggle('hidden', type.value !== 'Spending');
    };
    const selectButtons = (selector, value) => document.querySelectorAll(selector).forEach(button => button.classList.toggle('selected', button.dataset.editCategory === value || button.dataset.editBill === value || button.dataset.editShopping === value || button.dataset.editModifier === String(value)));
    const setCategory = (nextCategory, nextSubcategory) => {
      category = nextCategory;
      subcategory = nextSubcategory || (category === 'Bills' ? 'Water' : category === 'Shopping' ? 'Entertainment' : '');
      selectButtons('[data-edit-category]', category);
      selectButtons('[data-edit-bill]', category === 'Bills' ? subcategory : '');
      selectButtons('[data-edit-shopping]', category === 'Shopping' ? subcategory : '');
      updateType();
    };
    const loadEntry = entry => {
      editingId = entry.id;
      const inferredCategory = entry.category || (entry.type === 'Groceries' ? 'Groceries' : ['Water', 'Electricity', 'Gas'].includes(entry.type) ? 'Bills' : 'Shopping');
      const inferredSubcategory = entry.subcategory || (inferredCategory === 'Bills' ? entry.type : inferredCategory === 'Shopping' ? 'Entertainment' : '');
      amount.value = round(entry.original);
      modifier.value = round(entry.modifier).toFixed(2);
      month.innerHTML = data.months.map(item => `<option value="${item.id}">${item.label}</option>`).join('');
      month.value = entry.month;
      comment.value = entry.comment || '';
      setCategory(inferredCategory, inferredSubcategory);
      selectButtons('[data-edit-modifier]', Number(modifier.value));
      updateFinal();
      autosize(comment);
      editDialog.showModal();
      amount.focus();
    };

    document.getElementById('expenseEditCategoryOptions').addEventListener('click', event => {
      const button = event.target.closest('[data-edit-category]');
      if (button) setCategory(button.dataset.editCategory);
    });
    document.getElementById('expenseEditBillSuboptions').addEventListener('click', event => {
      const button = event.target.closest('[data-edit-bill]');
      if (button) setCategory('Bills', button.dataset.editBill);
    });
    document.getElementById('expenseEditShoppingSuboptions').addEventListener('click', event => {
      const button = event.target.closest('[data-edit-shopping]');
      if (button) setCategory('Shopping', button.dataset.editShopping);
    });
    document.getElementById('expenseEditModifierOptions').addEventListener('click', event => {
      const button = event.target.closest('[data-edit-modifier]');
      if (!button) return;
      modifier.value = button.dataset.editModifier;
      selectButtons('[data-edit-modifier]', Number(modifier.value));
      updateFinal();
    });
    amount.addEventListener('input', updateFinal);
    comment.addEventListener('input', () => autosize(comment));
    document.getElementById('closeExpenseEdit').onclick = () => editDialog.close();
    document.getElementById('cancelExpenseEdit').onclick = () => editDialog.close();
    editDialog.addEventListener('click', event => { if (event.target === editDialog) editDialog.close(); });
    document.addEventListener('click', event => {
      const button = event.target.closest?.('[data-edit-expense]');
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const entry = data.entries.find(item => item.id === button.dataset.editExpense);
      if (entry) loadEntry(entry);
    }, true);
    form.addEventListener('submit', event => {
      event.preventDefault();
      const entry = data.entries.find(item => item.id === editingId);
      const original = num(amount.value);
      const appliedModifier = Math.max(.9, Math.min(1, num(modifier.value)));
      if (!entry || original <= 0) return;
      const oldMonth = data.months.find(item => item.id === entry.month);
      const newMonth = data.months.find(item => item.id === month.value);
      const oldKey = entry.type.toLowerCase();
      const newType = type.value;
      const newKey = newType.toLowerCase();
      const newFinal = round(original * appliedModifier);
      if (oldMonth) oldMonth[oldKey] = round(oldMonth[oldKey] - entry.final);
      if (newMonth) newMonth[newKey] = round(newMonth[newKey] + newFinal);
      Object.assign(entry, { original, modifier: appliedModifier, type: newType, category, subcategory: category === 'Groceries' || category === 'Dining' ? '' : subcategory, month: month.value, final: newFinal, comment: newType === 'Spending' ? comment.value.trim().slice(0, 500) : '', updatedAt: new Date().toISOString() });
      save();
      [...new Set([oldMonth, newMonth].filter(Boolean))].forEach(syncMonth);
      syncEditedExpense(entry);
      editDialog.close();
      render();
    });
    document.querySelectorAll('#expenseDialog textarea, #expenseEditDialog textarea').forEach(field => {
      field.addEventListener('input', () => autosize(field));
      autosize(field);
    });
    renderHistory();
  })();

  (() => {
    const actionEditSvg = '<svg viewBox="0 0 21 21" aria-hidden="true"><path d="M20.2312.768845c-1.0252-1.025127-2.6872-1.025127-3.7123 0L15.3617 1.926 19.074 5.63831l1.1572-1.15715c1.0251-1.02513 1.0251-2.68719 0-3.712315Z" fill="currentColor"/><path d="m18.0134 6.69897-3.7124-3.71231L2.15021 15.1375c-.61679.6168-1.07018 1.3775-1.319198 2.2135l-.79978 2.6849c-.07862.2639-.00627.5497.188456.7444.19473.1948.48052.2671.74445.1885l2.68489-.7998c.83597-.249 1.59672-.7024 2.21351-1.3192L18.0134 6.69897Z" fill="currentColor"/></svg>';
    const decorateEditIcons = () => document.querySelectorAll('.history-icon-button[data-edit-expense]').forEach(button => { button.innerHTML = actionEditSvg; });
    const editedHistoryRender = renderHistory;
    renderHistory = () => { editedHistoryRender(); decorateEditIcons(); };

    categoryBarMonths = function () {
      return chartMonths().map(month => {
        const dining = round(data.entries
          .filter(entry => entry.month === month.id && entry.category === 'Shopping' && entry.subcategory === 'Dining')
          .reduce((sum, entry) => sum + num(entry.final), 0));
        return {
          ...month,
          expenses: round(Math.max(0, num(data.settings.fixedExpenses) + num(data.settings.kevinMortgage) + num(month.water) + num(month.electricity) + num(month.gas) - num(month.cashOffset))),
          groceries: num(month.groceries),
          dining,
          spendingOther: round(Math.max(0, num(month.spending) - dining))
        };
      });
    };
    const oneYearChartRender = renderCharts;
    renderCharts = () => {
      oneYearChartRender();
      const tabs = document.querySelector('#chartArea .chart-tabs');
      if (tabs && !tabs.querySelector('[data-chart-range="1"]')) {
        const button = document.createElement('button');
        button.dataset.chartRange = '1';
        button.textContent = '1 yr';
        tabs.prepend(button);
      }
      const oneYearButton = tabs?.querySelector('[data-chart-range="1"]');
      if (oneYearButton) oneYearButton.classList.toggle('selected', chartRange === '1');
      const subtitle = document.querySelector('#categoryBarsChart .chart-subtitle');
      if (subtitle) subtitle.textContent = chartRange === 'all' ? 'All time' : `${chartRange} year${chartRange === '1' ? '' : 's'}`;
    };
    renderCharts();
    renderHistory();
  })();

  (() => {
    let authorizedSession = false;
    const gate = document.createElement('main');
    gate.id = 'authGate';
    gate.innerHTML = '<section class="auth-card" aria-labelledby="authGateTitle"><h1 id="authGateTitle">Estuary</h1><p>Sign in with your authorized Google account to view your private budget.</p><button class="button primary" id="authGateSignIn">Sign in with Google</button><p id="authGateStatus" aria-live="polite">Checking sign-in…</p></section>';
    document.body.append(gate);

    const gateStatus = message => {
      const status = document.getElementById('authGateStatus');
      if (status) status.textContent = message;
    };
    const lockBudget = message => {
      authorizedSession = false;
      document.body.classList.add('auth-locked');
      document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
      gateStatus(message || 'Sign in with Google to continue.');
    };
    const unlockBudget = () => {
      authorizedSession = true;
      document.body.classList.remove('auth-locked');
    };

    document.getElementById('authGateSignIn').onclick = async () => {
      gateStatus('Opening Google sign-in…');
      await signInFirebase();
    };

    const gatedRender = render;
    render = () => {
      if (!authorizedSession) return;
      gatedRender();
    };

    const firebaseUserHandler = onFirebaseUser;
    onFirebaseUser = async user => {
      const isOwner = user?.uid === ownerUid;
      if (!isOwner) lockBudget(user ? 'This Google account is not authorized for Estuary.' : 'Sign in with Google to continue.');
      await firebaseUserHandler(user);
      if (isOwner && firebaseUser?.uid === ownerUid) {
        unlockBudget();
        gatedRender();
      }
    };

    lockBudget('Checking sign-in…');
  })();

  (() => {
    const title = document.querySelector('.top-header h1');
    if (title) {
      const brand = document.createElement('div');
      brand.className = 'brand-mark';
      brand.innerHTML = '<img src="app-icon.png?v=9" width="40" height="40" alt="Estuary">';
      title.replaceWith(brand);
    }
    document.querySelector('#expenseEditCategoryOptions [data-edit-category="Bills"]')?.remove();
  })();

  (() => {
    // Light is the default only for devices that have not explicitly chosen a theme.
    if (!localStorage.getItem('cream-corn-theme')) applyTheme('light');

    chartCard = function(title, points, color, extra = '') {
      const palette = {'#45b8b0':'#35b9b1','#e2ad4c':'#efb43b','#f0845c':'#4d96b7','#b28ad5':'#779fc2'};
      const smoothed = rollingAverage(points);
      const latest = smoothed.at(-1);
      const average = points.length ? points.reduce((sum, point) => sum + num(point.value), 0) / points.length : 0;
      return `<article class="chart-card"><div class="chart-card-head"><div><h3>${title}</h3><p class="chart-subtitle">3-month rolling average</p></div><div class="chart-card-actions"><span class="chart-average">Avg ${money(average)}</span>${extra}</div></div><p class="chart-value">Latest: ${money(latest?.value || 0)}</p>${chartSvg(smoothed, palette[color] || color)}</article>`;
    };

    const categoryPalette = { groceries:'#efb43b', dining:'#78b575', spending:'#4d96b7' };
    const categoryMonths = () => chartMonths().map(month => {
      const dining = round(data.entries.filter(entry => entry.month === month.id && entry.category === 'Shopping' && entry.subcategory === 'Dining').reduce((sum, entry) => sum + num(entry.final), 0));
      return { ...month, groceries:num(month.groceries), dining, spendingOther:round(Math.max(0, num(month.spending) - dining)) };
    });
    const renderCategoryBarsWithoutExpenses = () => {
      document.getElementById('categoryBarsChart')?.remove();
      const months = categoryMonths();
      const chart = document.createElement('article');
      chart.id = 'categoryBarsChart';
      chart.className = 'chart-card category-bars-chart';
      if (!months.length) { chart.innerHTML = '<div class="chart-card-head"><div><h3>Spending by category</h3></div></div><div class="chart-empty">No monthly data yet.</div>'; chartArea.append(chart); return; }
      const width=1040,height=360,left=58,right=20,top=22,bottom=56,plotWidth=width-left-right,plotHeight=height-top-bottom,maxValue=Math.max(1,...months.flatMap(month=>[month.groceries+month.dining,month.spendingOther])),tickStep=Math.max(100,Math.ceil(maxValue/4/100)*100),topTick=tickStep*4,y=value=>top+plotHeight-value/topTick*plotHeight,groupWidth=plotWidth/months.length,barWidth=Math.min(28,Math.max(12,groupWidth*.3)),foodGap=2,monthLabel=month=>({name:monthLabels[Number(month.id.slice(5,7))-1].slice(0,3),year:month.id.slice(2,4)});
      const bars=months.map((month,index)=>{const center=left+groupWidth*index+groupWidth/2,foodX=center-barWidth-3,spendingX=center+3,groceryY=y(month.groceries),diningY=y(month.groceries+month.dining),groceryHeight=Math.max(0,top+plotHeight-groceryY),diningHeight=Math.max(0,top+plotHeight-diningY),spendingHeight=Math.max(0,top+plotHeight-y(month.spendingOther)),diningBarHeight=Math.max(0,diningHeight-(month.dining&&month.groceries?foodGap:0)),label=monthLabel(month);return `<g class="category-bar-group"><rect class="category-bar" x="${foodX}" y="${groceryY}" width="${barWidth}" height="${groceryHeight}" fill="${categoryPalette.groceries}"><title>${month.label}\nGroceries: ${money(month.groceries)}</title></rect>${month.dining?`<rect class="category-bar" x="${foodX}" y="${diningY}" width="${barWidth}" height="${diningBarHeight}" fill="${categoryPalette.dining}"><title>${month.label}\nDining: ${money(month.dining)}</title></rect>`:''}<rect class="category-bar" x="${spendingX}" y="${y(month.spendingOther)}" width="${barWidth}" height="${spendingHeight}" fill="${categoryPalette.spending}"><title>${month.label}\nSpending: ${money(month.spendingOther)}</title></rect><text class="chart-axis-label category-bar-month" x="${center}" y="${height-31}" text-anchor="middle"><tspan x="${center}">${label.name}</tspan><tspan x="${center}" dy="13">${label.year}</tspan></text></g>`}).join('');
      const ticks=[0,1,2,3,4].map(index=>{const value=tickStep*index;return `<g><line class="chart-grid-line" x1="${left}" x2="${width-right}" y1="${y(value)}" y2="${y(value)}"/><text class="chart-axis-label" x="${left-10}" y="${y(value)+4}" text-anchor="end">${money(value)}</text></g>`}).join('');
      chart.innerHTML=`<div class="chart-card-head"><div><h3>Spending by category</h3><p class="chart-subtitle">${chartRange==='all'?'All time':`${chartRange} year${chartRange==='1'?'':'s'}`}</p></div></div><div class="category-bar-viewport"><svg class="category-bar-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly spending by category, with dining and groceries, and other spending">${ticks}<line class="chart-axis" x1="${left}" x2="${width-right}" y1="${top+plotHeight}" y2="${top+plotHeight}"/>${bars}</svg></div><div class="category-bar-legend"><span><i style="background:${categoryPalette.groceries}"></i>Groceries</span><span><i style="background:${categoryPalette.dining}"></i>Dining</span><span><i style="background:${categoryPalette.spending}"></i>Spending</span></div>`;
      chartArea.append(chart);
    };
    const priorChartRender = renderCharts;
    renderCharts = () => { priorChartRender(); renderCategoryBarsWithoutExpenses(); };

    let fixedItemsNeedSync = false;
    const fixedItemTotal = () => round((data.settings.fixedExpenseItems || []).reduce((sum, item) => sum + num(item.amount), 0));
    const normalizeFixedItems = () => {
      if (!Array.isArray(data.settings.fixedExpenseItems) || !data.settings.fixedExpenseItems.length) { data.settings.fixedExpenseItems = [{ id:'base-fixed-expense', label:'Fixed monthly expenses', amount:num(data.settings.fixedExpenses) }]; fixedItemsNeedSync = true; }
      data.settings.fixedExpenseItems = data.settings.fixedExpenseItems.map((item, index) => ({ id:item.id || `fixed-${index}`, label:String(item.label || 'Expense'), amount:num(item.amount) }));
      data.settings.fixedExpenses = fixedItemTotal();
    };
    const setupExpenseSettingsTabs = () => {
      const settingsPanel = document.querySelector('#settings .panel.settings');
      const fixedInput = document.querySelector('[data-setting="fixedExpenses"]');
      if (!settingsPanel || !fixedInput) return;
      let mortgageInput = document.querySelector('[data-setting="mortgagePayment"]');
      if (!mortgageInput) {
        const mortgageField = document.createElement('label');
        mortgageField.append('Mortgage Payment');
        mortgageInput = document.createElement('input');
        mortgageInput.type = 'number';
        mortgageInput.inputMode = 'decimal';
        mortgageInput.dataset.setting = 'mortgagePayment';
        mortgageField.append(mortgageInput);
        fixedInput.closest('label')?.before(mortgageField);
      }
      normalizeFixedItems();
      if (fixedItemsNeedSync && firebaseUser) { save(); syncSettings(); fixedItemsNeedSync = false; }
      let host = document.getElementById('expenseSettingsTabs');
      if (!host) {
        const fields = ['mortgagePayment','meganR1','meganR2','kevinMortgage','fixedExpenses','foodShare'].map(key => document.querySelector(`[data-setting="${key}"]`)?.closest('label')).filter(Boolean);
        host = document.createElement('section');
        host.id = 'expenseSettingsTabs';
        host.className = 'expense-settings-tabs';
        host.innerHTML = '<div class="settings-tab-list" role="tablist"><button type="button" class="settings-tab active" data-expense-settings-tab="one" role="tab" aria-selected="true">Expenses 1</button><button type="button" class="settings-tab" data-expense-settings-tab="two" role="tab" aria-selected="false">Static Values</button></div><div class="settings-tab-panel" data-expense-settings-panel="one"></div><div class="settings-tab-panel" data-expense-settings-panel="two" hidden></div>';
        fields[0]?.before(host);
        const firstPanel = host.querySelector('[data-expense-settings-panel="one"]');
        fields.forEach(field => firstPanel.append(field));
        const kevinInput = document.querySelector('[data-setting="kevinMortgage"]');
        kevinInput.disabled = true;
        kevinInput.setAttribute('aria-describedby','kevinMortgageHelp');
        const kevinHelper = document.createElement('p'); kevinHelper.id = 'kevinMortgageHelp'; kevinHelper.className = 'small'; kevinHelper.textContent = 'Calculated as Mortgage Payment minus Megan Mortgage.'; kevinInput.closest('label').append(kevinHelper);
        fixedInput.disabled = true;
        fixedInput.setAttribute('aria-describedby','fixedExpensesHelp');
        const helper = document.createElement('p'); helper.id = 'fixedExpensesHelp'; helper.className = 'small'; helper.textContent = 'Calculated from Static Values.'; fixedInput.closest('label').append(helper);
        host.addEventListener('click', event => {
          const tab = event.target.closest('[data-expense-settings-tab]');
          if (tab) { const choice=tab.dataset.expenseSettingsTab; host.querySelectorAll('[data-expense-settings-tab]').forEach(button=>{const active=button===tab;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));}); host.querySelectorAll('[data-expense-settings-panel]').forEach(panel=>panel.hidden=panel.dataset.expenseSettingsPanel!==choice); return; }
          if (event.target.closest('[data-add-fixed-expense]')) { data.settings.fixedExpenseItems.push({id:`fixed-${crypto.randomUUID()}`,label:'New expense',amount:0}); data.settings.fixedExpenses=fixedItemTotal(); save(); syncSettings(); render(); return; }
          const remove = event.target.closest('[data-remove-fixed-expense]');
          if (remove) { data.settings.fixedExpenseItems=data.settings.fixedExpenseItems.filter(item=>item.id!==remove.dataset.removeFixedExpense); data.settings.fixedExpenses=fixedItemTotal(); save(); syncSettings(); render(); }
        });
        host.addEventListener('change', event => { const input=event.target.closest('[data-fixed-expense-field]'); if (!input) return; const item=data.settings.fixedExpenseItems.find(entry=>entry.id===input.dataset.fixedExpenseId); if (!item) return; item[input.dataset.fixedExpenseField]=input.dataset.fixedExpenseField==='amount'?num(input.value):input.value.trim(); data.settings.fixedExpenses=fixedItemTotal(); save(); syncSettings(); render(); });
      }
      mortgageInput.value=round(data.settings.mortgagePayment);
      const kevinInput=document.querySelector('[data-setting="kevinMortgage"]');
      kevinInput.value=round(data.settings.kevinMortgage);
      fixedInput.value=round(data.settings.fixedExpenses);
      const secondPanel=host.querySelector('[data-expense-settings-panel="two"]');
      secondPanel.innerHTML=`<p class="small">These values add up to Fixed monthly expenses.</p><div class="fixed-expense-items">${data.settings.fixedExpenseItems.map(item=>`<div class="fixed-expense-row"><input type="text" aria-label="Expense name" data-fixed-expense-field="label" data-fixed-expense-id="${item.id}" value="${escapeHtml(item.label)}"><input type="number" inputmode="decimal" aria-label="Expense amount" data-fixed-expense-field="amount" data-fixed-expense-id="${item.id}" value="${round(item.amount)}"><button type="button" class="fixed-expense-remove" data-remove-fixed-expense="${item.id}" aria-label="Remove ${escapeHtml(item.label)}" ${data.settings.fixedExpenseItems.length===1?'disabled':''}>×</button></div>`).join('')}</div><div class="fixed-expense-actions"><button type="button" class="button ghost" data-add-fixed-expense>+ Add expense</button></div>`;
    };
    const settingsRender = render;
    render = () => { settingsRender(); setupExpenseSettingsTabs(); };
    render();
  })();

  (() => {
    const addButton=document.getElementById('saveExpense');
    const originalAddExpense=addButton?.onclick;
    let expenseFeedback=null;
    let feedbackTimer=0;
    const feedbackTargets = type => type==='Spending'?[0,2,3]:type==='Groceries'?[1,2,3]:[2,3];
    const renderExpenseFeedback = () => {
      document.querySelectorAll('.metric-expense-delta').forEach(node=>node.remove());
      document.querySelectorAll('.metric-value-feedback').forEach(row=>{
        const value=row.querySelector(':scope > strong');
        if(value)row.replaceWith(value);
      });
      if(!expenseFeedback||Date.now()>=expenseFeedback.expires)return;
      const cards=[...document.querySelectorAll('#metrics .metric')];
      feedbackTargets(expenseFeedback.type).forEach(index=>{
        const value=cards[index]?.querySelector('strong');
        if(!value)return;
        const row=document.createElement('div');
        row.className='metric-value-feedback';
        value.before(row);
        row.append(value);
        const delta=document.createElement('span');
        const increases=index<2;
        delta.className='metric-expense-delta';
        delta.setAttribute('aria-hidden','true');
        delta.textContent=`${increases?'↑':'↓'} ${money(expenseFeedback.amount)}`;
        row.append(delta);
      });
    };
    if(addButton&&originalAddExpense)addButton.onclick=event=>{
      const original=num(document.getElementById('expenseAmount')?.value);
      const modifier=Math.max(.9,Math.min(1,num(document.getElementById('expenseModifier')?.value)));
      const amount=round(original*modifier);
      const type=document.getElementById('expenseType')?.value;
      originalAddExpense.call(addButton,event);
      if(original<=0||!['Spending','Groceries','Water','Electricity','Gas'].includes(type))return;
      expenseFeedback={amount,type,expires:Date.now()+2500};
      window.clearTimeout(feedbackTimer);
      renderExpenseFeedback();
      feedbackTimer=window.setTimeout(()=>{expenseFeedback=null;renderExpenseFeedback()},2500);
    };
    const previousRender=render;
    render=()=>{previousRender();renderExpenseFeedback();if(displayMode)applyDisplayMode()};
  })();

  (() => {
    let gradientNumber=0;
    const smoothSvgPath = coordinates => {
      if (!coordinates.length) return '';
      if (coordinates.length === 1) return `M ${coordinates[0].x.toFixed(1)} ${coordinates[0].y.toFixed(1)}`;
      let path=`M ${coordinates[0].x.toFixed(1)} ${coordinates[0].y.toFixed(1)}`;
      for(let index=0;index<coordinates.length-1;index++){
        const p0=coordinates[index-1]||coordinates[index];
        const p1=coordinates[index];
        const p2=coordinates[index+1];
        const p3=coordinates[index+2]||p2;
        const low=Math.min(p1.y,p2.y),high=Math.max(p1.y,p2.y);
        const cp1x=p1.x+(p2.x-p0.x)/6;
        const cp1y=Math.max(low,Math.min(high,p1.y+(p2.y-p0.y)/6));
        const cp2x=p2.x-(p3.x-p1.x)/6;
        const cp2y=Math.max(low,Math.min(high,p2.y-(p3.y-p1.y)/6));
        path+=` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      }
      return path;
    };

    chartSvg = (points,color) => {
      if(!points.length)return '<div class="chart-empty">No monthly data yet.</div>';
      const width=520,height=220,left=52,right=16,top=18,bottom=42;
      const plotWidth=width-left-right,plotHeight=height-top-bottom;
      const values=points.map(point=>point.average),trend=trendPoints(values);
      const min=Math.min(0,...values,...trend),max=Math.max(0,...values,...trend),range=max-min||1;
      const x=index=>left+index*plotWidth/Math.max(points.length-1,1);
      const y=value=>top+(max-value)*plotHeight/range;
      const yTicks=[max,round((max+min)/2),min];
      const xIndexes=[...new Set([0,Math.floor((points.length-1)/2),points.length-1])];
      const coordinates=points.map((point,index)=>({x:x(index),y:y(point.average)}));
      const linePath=smoothSvgPath(coordinates);
      const baseline=height-bottom;
      const areaPath=`${linePath} L ${coordinates.at(-1).x.toFixed(1)} ${baseline} L ${coordinates[0].x.toFixed(1)} ${baseline} Z`;
      const trendPath=trend.length?`M ${x(0).toFixed(1)} ${y(trend[0]).toFixed(1)} L ${x(points.length-1).toFixed(1)} ${y(trend[1]).toFixed(1)}`:'';
      const gradientId=`chart-gradient-${++gradientNumber}`;
      return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Smoothed three-month rolling average chart with trend line"><defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity=".18"/><stop offset="55%" stop-color="${color}" stop-opacity=".07"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${yTicks.map(value=>`<g><line class="chart-grid-line" x1="${left}" x2="${width-right}" y1="${y(value)}" y2="${y(value)}"/><text class="chart-axis-label" x="${left-8}" y="${y(value)+4}" text-anchor="end">${money(value)}</text></g>`).join('')}<path class="chart-gradient-area" d="${areaPath}" fill="url(#${gradientId})"/><line class="chart-axis" x1="${left}" x2="${width-right}" y1="${baseline}" y2="${baseline}"/><path d="${trendPath}" fill="none" stroke="${color}" stroke-opacity=".5" stroke-width="3" stroke-dasharray="7 6" stroke-linecap="round"/><path d="${linePath}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>${points.map((point,index)=>`<g><circle cx="${x(index)}" cy="${y(point.average)}" r="3.5" fill="${color}"/><circle class="chart-point" data-chart-label="${escapeHtml(point.label)}" data-chart-value="${money(point.value)}" data-chart-average="${money(point.average)}" cx="${x(index)}" cy="${y(point.average)}" r="13" fill="${color}" fill-opacity=".001"/></g>`).join('')}${xIndexes.map(index=>`<g><line class="chart-axis" x1="${x(index)}" x2="${x(index)}" y1="${baseline}" y2="${baseline+5}"/><text class="chart-axis-label" x="${x(index)}" y="${height-15}" text-anchor="middle">${points[index].label.split(' ')[0].slice(0,3)} ${points[index].label.split(' ').at(-1)}</text></g>`).join('')}</svg>`;
    };
    render();
  })();

  (() => {
    const panelHeading = (eyebrow, title, description = '') => {
      const heading = document.createElement('div');
      heading.className = 'settings-panel-heading';
      heading.innerHTML = `<p class="eyebrow">${eyebrow}</p><h2>${title}</h2>${description ? `<p class="small">${description}</p>` : ''}`;
      return heading;
    };
    const refreshSyncPanel = () => {
      const signedIn = firebaseUser?.uid === ownerUid;
      document.getElementById('firebaseSignIn')?.classList.toggle('hidden', signedIn);
      document.getElementById('firebaseSignOut')?.classList.toggle('hidden', !signedIn);
    };
    const organizeSettingsPanels = () => {
      const settings = document.getElementById('settings');
      const stack = settings?.querySelector(':scope > .grid');
      const budget = stack?.querySelector('.panel.settings');
      const sync = document.getElementById('firebaseStatus')?.closest('.panel');
      if (!stack || !budget || !sync) return;
      stack.classList.add('settings-panel-stack');
      budget.classList.add('settings-budget');
      const budgetTitle = budget.querySelector(':scope > h2');
      if (budgetTitle) budgetTitle.textContent = 'Budget Settings';
      sync.classList.add('settings-sync');
      const syncEyebrow = sync.querySelector('.eyebrow');
      const syncTitle = sync.querySelector('h2');
      const syncDescription = sync.querySelector('.small:not(#firebaseStatus)');
      if (syncEyebrow) syncEyebrow.textContent = 'SYNC';
      if (syncTitle) syncTitle.textContent = 'Sync';
      if (syncDescription) syncDescription.textContent = 'Sign in with your authorized Google account to keep Estuary in sync across your devices.';

      let display = document.getElementById('displaySettingsPanel');
      if (!display) {
        display = document.createElement('article');
        display.id = 'displaySettingsPanel';
        display.className = 'panel settings-display';
        display.append(panelHeading('DISPLAY', 'Display'));
      }
      const appearance = document.getElementById('themeSettingsToggle')?.closest('div');
      const displayMode = document.querySelector('.display-mode-control');
      if (appearance) display.append(appearance);
      if (displayMode) display.append(displayMode);

      let backup = document.getElementById('backupSettingsPanel');
      if (!backup) {
        backup = document.createElement('article');
        backup.id = 'backupSettingsPanel';
        backup.className = 'panel settings-backup';
        backup.append(panelHeading('BACKUP & RESTORE', 'Backup & Restore', 'Download an encrypted backup or restore one when needed.'));
      }
      const backupTools = document.getElementById('backupSection');
      if (backupTools) backup.append(backupTools);

      const expenseTabs = document.getElementById('expenseSettingsTabs');
      const incomeHistory = document.getElementById('incomeHistory');
      if (expenseTabs && incomeHistory) {
        let divider = budget.querySelector('.budget-settings-divider');
        if (!divider) { divider = document.createElement('hr'); divider.className = 'budget-settings-divider'; }
        budget.append(expenseTabs, divider, incomeHistory);
      }
      stack.replaceChildren(display, sync, backup, budget);
      refreshSyncPanel();
    };
    const settingsLayoutRender = render;
    render = () => { settingsLayoutRender(); organizeSettingsPanels(); };
    const settingsUserHandler = onFirebaseUser;
    onFirebaseUser = async user => { await settingsUserHandler(user); organizeSettingsPanels(); };
    organizeSettingsPanels();
  })();

  (() => {
    const priorMonth = monthId => {
      const [year, month] = monthId.split('-').map(Number);
      const date = new Date(year, month - 2, 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    };

    renderIncomeLevels = (message = '') => {
      setupIncomeHistory();
      const host = document.getElementById('incomeHistory');
      if (!host) return;
      normalizeIncomeLevels();
      const levels = [...data.settings.incomeLevels]
        .sort((a, b) => String(b.start).localeCompare(String(a.start)));
      host.innerHTML = `<p class="eyebrow">INCOME HISTORY</p><h2>Kevin income levels</h2><div class="income-level-head"><span>Biweekly Paycheck Amount</span><span>From</span><span>Through</span><span></span></div><div>${levels.map((level, index) => {
        const current = index === 0;
        return `<div class="income-level-row"><input type="number" inputmode="decimal" aria-label="Biweekly Paycheck Amount" data-income-field="paycheck" data-income-id="${level.id}" value="${round(level.paycheck)}"><input type="month" aria-label="Income level start month" data-income-field="start" data-income-id="${level.id}" value="${level.start}">${current ? '<input class="income-level-current" type="text" aria-label="Income level end month" value="Current" readonly>' : `<input type="month" aria-label="Income level end month" data-income-field="end" data-income-id="${level.id}" value="${level.end}">`}<button type="button" class="income-level-remove" data-remove-income="${level.id}" aria-label="Remove income level" ${levels.length === 1 ? 'disabled' : ''}>×</button></div>`;
      }).join('')}</div><div class="income-history-actions"><button type="button" class="button ghost" id="addIncomeLevel" data-income-level-bound="true">+ Add income level</button><button type="button" class="button primary" id="applyIncomeHistory">Apply ranges to completed months</button></div><p class="income-history-notice">${message || 'Completed months stay fixed after they are applied; future completed months lock automatically.'}</p>`;
    };

    document.addEventListener('click', event => {
      const add = event.target.closest('#addIncomeLevel');
      if (!add || add.dataset.incomeLevelBound) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      normalizeIncomeLevels();
      const start = currentMonthKey();
      const current = [...data.settings.incomeLevels]
        .sort((a, b) => String(b.start).localeCompare(String(a.start)))[0];
      if (current && !current.end) current.end = priorMonth(start);
      data.settings.incomeLevels.push({
        id: `income-${Date.now()}`,
        start,
        end: '',
        paycheck: paycheckForMonth({ id:start, incomePaycheck:undefined })
      });
      syncLegacyMonthlyIncome();
      save();
      syncSettings();
      render();
    }, true);

    render();
  })();

  (() => {
    const overview = document.getElementById('overview');
    const metricsNode = document.getElementById('metrics');
    const insights = document.createElement('aside');
    insights.id = 'overviewInsights';
    insights.className = 'overview-insights hidden';
    metricsNode?.before(insights);

    const renderInsights = () => {
      if (!insights) return;
      const current = currentMonthKey();
      const completed = data.months.filter(month => month.id < current).sort((a,b) => a.id.localeCompare(b.id));
      const latest = completed.at(-1);
      if (!latest) { insights.classList.add('hidden'); return; }
      const messages = [];
      const previousThree = completed.slice(-4, -1);
      if (previousThree.length === 3) {
        const average = previousThree.reduce((sum, month) => sum + num(month.spending), 0) / previousThree.length;
        const difference = round(num(latest.spending) - average);
        if (Math.abs(difference) >= 1) messages.push(`Spending in <b>${monthLabels[Number(latest.id.slice(5,7))-1].slice(0,3)}</b> is <b>${money(Math.abs(difference))}</b> ${difference < 0 ? 'below' : 'above'} your three-month average.`);
      }
      const sameMonthLastYear = data.months.find(month => month.id === `${Number(latest.id.slice(0,4)) - 1}-${latest.id.slice(5)}`);
      if (sameMonthLastYear && num(sameMonthLastYear.groceries) > 0) {
        const change = round((num(latest.groceries) - num(sameMonthLastYear.groceries)) / num(sameMonthLastYear.groceries) * 100);
        if (change) messages.push(`Food is <b>${Math.abs(change)}%</b> ${change > 0 ? 'above' : 'below'} last ${monthLabels[Number(latest.id.slice(5,7))-1]}.`);
      }
      const year = Number(latest.id.slice(0,4));
      const cutoff = latest.id.slice(5);
      const savedToDate = data.months.filter(month => month.id.startsWith(`${year}-`) && month.id.slice(5) <= cutoff).reduce((sum, month) => sum + total(month).saved, 0);
      const savedLastYear = data.months.filter(month => month.id.startsWith(`${year - 1}-`) && month.id.slice(5) <= cutoff).reduce((sum, month) => sum + total(month).saved, 0);
      if (savedLastYear || savedToDate) {
        const difference = round(savedToDate - savedLastYear);
        if (difference) messages.push(`You've saved <b>${money(Math.abs(difference))}</b> ${difference > 0 ? 'more' : 'less'} than this point last year.`);
      }
      insights.innerHTML = messages.slice(0, 3).map(message => `<p class="overview-insight">${message}</p>`).join('');
      insights.classList.toggle('hidden', !messages.length);
    };

    const insightRender = render;
    render = () => { insightRender(); renderInsights(); };

    window.addIncomeLevel = event => {
      event?.preventDefault();
      event?.stopPropagation();
      normalizeIncomeLevels();
      const start = currentMonthKey();
      const levels = [...data.settings.incomeLevels].sort((a,b) => String(b.start).localeCompare(String(a.start)));
      const current = levels[0];
      if (current && !current.end) {
        const [year, month] = start.split('-').map(Number);
        const date = new Date(year, month - 2, 1);
        current.end = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      data.settings.incomeLevels.push({ id:`income-${Date.now()}`, start, end:'', paycheck:paycheckForMonth({id:start, incomePaycheck:undefined}) });
      syncLegacyMonthlyIncome();
      save();
      syncSettings();
      render();
      const notice = document.querySelector('.income-history-notice');
      if (notice) notice.textContent = 'New income level added. Set its paycheck amount and start month.';
    };

    const bindIncomeLevelButton = () => {
      const button = document.getElementById('addIncomeLevel');
      if (!button) return;
      button.dataset.incomeLevelBound = 'true';
      button.onclick = window.addIncomeLevel;
    };
    const incomeButtonRender = render;
    render = () => { incomeButtonRender(); bindIncomeLevelButton(); };
    render();
  })();

  (() => {
    const installBanner = document.getElementById('installBanner');
    const installButton = document.getElementById('installApp');
    const settingsStack = () => document.querySelector('#settings > .grid');
    const installPanel = document.createElement('article');
    installPanel.id = 'installSettingsPanel';
    installPanel.className = 'panel settings-install';
    installPanel.innerHTML = '<p class="eyebrow">INSTALL APP</p><h2>Estuary on this device</h2><p class="small" id="installSettingsStatus">Chrome will make installation available when this device is eligible.</p>';
    if (installBanner) {
      installBanner.classList.remove('hidden');
      installPanel.append(installBanner);
    }
    const placeInstallPanel = () => settingsStack()?.append(installPanel);
    const updateInstallStatus = () => {
      const status = document.getElementById('installSettingsStatus');
      if (!status || !installButton) return;
      const ready = Boolean(deferredInstallPrompt);
      installButton.disabled = !ready;
      status.textContent = ready ? 'Install Estuary for faster access from your home screen.' : 'Chrome will make installation available when this device is eligible.';
    };
    const baseInstallRender = render;
    render = () => { baseInstallRender(); placeInstallPanel(); updateInstallStatus(); };
    window.addEventListener('beforeinstallprompt', () => { placeInstallPanel(); updateInstallStatus(); });
    window.addEventListener('appinstalled', () => { placeInstallPanel(); updateInstallStatus(); });
    const originalInstallClick = installButton?.onclick;
    if (installButton) installButton.onclick = async event => { await originalInstallClick?.(event); placeInstallPanel(); updateInstallStatus(); };
    render();
  })();

  (() => {
    const monthBefore = monthId => {
      const [year, month] = monthId.split('-').map(Number);
      const date = new Date(year, month - 2, 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    };
    const persistIncomeLevels = () => { syncLegacyMonthlyIncome(); save(); syncSettings(); render(); };

    window.updateIncomeLevel = (event, id, field) => {
      event?.stopPropagation();
      normalizeIncomeLevels();
      const level = data.settings.incomeLevels.find(item => item.id === id);
      if (!level) return;
      level[field] = field === 'paycheck' ? num(event.target.value) : event.target.value;
      persistIncomeLevels();
    };
    window.removeIncomeLevel = (event, id) => {
      event?.preventDefault(); event?.stopPropagation();
      normalizeIncomeLevels();
      if (data.settings.incomeLevels.length === 1) return;
      data.settings.incomeLevels = data.settings.incomeLevels.filter(item => item.id !== id);
      persistIncomeLevels();
    };
    window.applyIncomeRanges = event => {
      event?.preventDefault(); event?.stopPropagation();
      const current = currentMonthKey();
      data.months.forEach(month => { if (month.id < current) month.incomePaycheck = paycheckForMonth({...month, incomePaycheck:undefined}); });
      data.settings.incomeHistoryLocked = true;
      persistIncomeLevels();
      data.months.filter(month => month.id < current).forEach(syncMonth);
      const notice = document.querySelector('.income-history-notice');
      if (notice) notice.textContent = 'Completed months now use the income levels shown above.';
    };
    window.addIncomeLevel = event => {
      event?.preventDefault(); event?.stopPropagation();
      normalizeIncomeLevels();
      const start = currentMonthKey();
      const current = [...data.settings.incomeLevels].sort((a,b) => String(b.start).localeCompare(String(a.start)))[0];
      if (current && !current.end) current.end = monthBefore(start);
      data.settings.incomeLevels.push({ id:`income-${Date.now()}`, start, end:'', paycheck:current ? num(current.paycheck) : round(num(data.settings.monthlyIncome) * 12 / 26) });
      persistIncomeLevels();
      const notice = document.querySelector('.income-history-notice');
      if (notice) notice.textContent = 'New income level added. Set its paycheck amount and start month.';
    };

    renderIncomeLevels = (message = '') => {
      setupIncomeHistory();
      const host = document.getElementById('incomeHistory');
      if (!host) return;
      normalizeIncomeLevels();
      const levels = [...data.settings.incomeLevels].sort((a,b) => String(b.start).localeCompare(String(a.start)));
      host.innerHTML = `<p class="eyebrow">INCOME HISTORY</p><h2>Kevin income levels</h2><div class="income-level-head"><span>Biweekly Check Amt</span><span>From</span><span>Through</span><span></span></div><div>${levels.map((level, index) => {
        const current = index === 0;
        return `<div class="income-level-row"><label class="income-level-paycheck"><span>Biweekly Check Amt</span><input type="number" inputmode="decimal" aria-label="Biweekly Check Amount" value="${round(level.paycheck)}"></label><div class="income-level-dates"><label><span>From</span><input type="month" aria-label="Income level start month" value="${level.start}"></label>${current ? '<label><span>Through</span><input class="income-level-current" type="text" aria-label="Income level end month" value="Current" readonly></label>' : `<label><span>Through</span><input type="month" aria-label="Income level end month" value="${level.end}"></label>`}</div><button type="button" class="income-level-remove" aria-label="Remove income level" ${levels.length === 1 ? 'disabled' : ''}>×</button></div>`;
      }).join('')}</div><div class="income-history-actions"><button type="button" class="button ghost" id="addIncomeLevel" data-income-level-bound="true">+ Add income level</button><button type="button" class="button primary" id="applyIncomeHistory">Apply ranges to completed months</button></div><p class="income-history-notice">${message || 'Completed months stay fixed after they are applied; future completed months lock automatically.'}</p>`;
    };
    render();
  })();

  (() => {
    const priorIncomeMonth = monthId => { const [year, month] = monthId.split('-').map(Number); const date = new Date(year, month - 2, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; };
    const nextIncomeMonth = monthId => { const [year, month] = monthId.split('-').map(Number); const date = new Date(year, month, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; };
    const formatIncomeMonth = monthId => monthId ? `${monthId.slice(5)}/${monthId.slice(0,4)}` : '';
    const parseIncomeMonth = value => { const digits = String(value || '').replace(/\D/g, ''); if (digits.length !== 6) return ''; const month = Number(digits.slice(0,2)), year = digits.slice(2); return month >= 1 && month <= 12 ? `${year}-${String(month).padStart(2,'0')}` : ''; };
    window.formatIncomeMonthInput = input => { const digits = String(input.value || '').replace(/\D/g, '').slice(0,6); input.value = digits.length > 2 ? `${digits.slice(0,2)}/${digits.slice(2)}` : digits; };
    const incomeTimeline = () => { normalizeIncomeLevels(); const levels = [...data.settings.incomeLevels].sort((a,b) => String(b.start).localeCompare(String(a.start))); levels.forEach((level, index) => { level.end = index === 0 ? '' : priorIncomeMonth(levels[index - 1].start); }); return levels; };
    const persistIncomeTimeline = () => { syncLegacyMonthlyIncome(); save(); syncSettings(); render(); };
    const timelineNotice = text => { const notice = document.querySelector('.income-history-notice'); if (notice) notice.textContent = text; };
    window.updateIncomeTimeline = (event, id, field) => { event?.stopPropagation(); const levels = incomeTimeline(), index = levels.findIndex(level => level.id === id), level = levels[index]; if (!level) return; if (field === 'paycheck') level.paycheck = num(event.target.value); else { const value = parseIncomeMonth(event.target.value), above = levels[index - 1], below = levels[index + 1]; if (!value) { render(); timelineNotice('Enter the month as MM/YYYY.'); return; } if ((above && value >= above.start) || (below && value <= below.start)) { render(); timelineNotice('Choose a start month between the adjacent income levels.'); return; } level.start = value; } incomeTimeline(); persistIncomeTimeline(); };
    window.addPastIncome = event => { event?.preventDefault(); event?.stopPropagation(); const levels = incomeTimeline(), oldest = levels.at(-1); data.settings.incomeLevels.push({ id:`income-${Date.now()}`, start:priorIncomeMonth(oldest.start), end:'', paycheck:num(oldest.paycheck) }); incomeTimeline(); persistIncomeTimeline(); timelineNotice('Past income level added. Set its start month and paycheck amount.'); };
    window.addIncomeRaise = event => { event?.preventDefault(); event?.stopPropagation(); const levels = incomeTimeline(), current = levels[0], start = currentMonthKey(); if (current && start <= current.start) { timelineNotice('The current income level already starts this month.'); return; } data.settings.incomeLevels.push({ id:`income-${Date.now()}`, start, end:'', paycheck:num(current?.paycheck) }); incomeTimeline(); persistIncomeTimeline(); timelineNotice('New current income level added. Update its paycheck amount.'); };
    window.removeIncomeTimeline = (event, id) => { event?.preventDefault(); event?.stopPropagation(); if (data.settings.incomeLevels.length === 1) return; data.settings.incomeLevels = data.settings.incomeLevels.filter(level => level.id !== id); incomeTimeline(); persistIncomeTimeline(); };
    renderIncomeLevels = (message = '') => { setupIncomeHistory(); const host = document.getElementById('incomeHistory'); if (!host) return; const levels = incomeTimeline(); host.innerHTML = `<p class="eyebrow">INCOME HISTORY</p><h2>Kevin income levels</h2><div class="income-level-head"><span>Biweekly Check Amt</span><span>From</span><span>Through</span><span></span></div><div>${levels.map((level, index) => { const current = index === 0; return `<div class="income-level-row"><label class="income-level-paycheck"><span>Biweekly Check Amt</span><input type="number" inputmode="decimal" aria-label="Biweekly Check Amount" value="${round(level.paycheck)}" data-income-action="update" data-income-id="${level.id}" data-income-field="paycheck"></label><div class="income-level-dates"><label><span>From</span><input type="text" inputmode="numeric" maxlength="7" placeholder="MM/YYYY" aria-label="Income level start month" value="${formatIncomeMonth(level.start)}" data-income-format="month" data-income-action="update" data-income-id="${level.id}" data-income-field="start"></label><label><span>Through</span><input class="income-level-current" type="text" aria-label="Income level end month" value="${current ? 'Current' : formatIncomeMonth(level.end)}" readonly></label></div><button type="button" class="income-level-remove" aria-label="Remove income level" ${levels.length === 1 ? 'disabled' : ''} data-income-action="remove" data-income-id="${level.id}">×</button></div>`; }).join('')}</div><div class="income-history-actions"><button type="button" class="button ghost" data-income-action="add-past">+ Add Past Income</button><button type="button" class="button ghost" data-income-action="add-raise">+ Add Raise</button><button type="button" class="button primary" id="applyIncomeHistory" data-income-action="apply">Apply ranges to completed months</button></div><p class="income-history-notice">${message || 'Each Through month is calculated automatically from the income level above.'}</p>`; };
    document.addEventListener('input', event => { if (event.target.matches('[data-income-format="month"]')) window.formatIncomeMonthInput(event.target); });
    document.addEventListener('change', event => { const input=event.target.closest('[data-income-action="update"]'); if (input) window.updateIncomeTimeline(event,input.dataset.incomeId,input.dataset.incomeField); });
    document.addEventListener('click', event => { const control=event.target.closest('[data-income-action]'); if (!control||control.matches('input')) return; const action=control.dataset.incomeAction;if(action==='remove')window.removeIncomeTimeline(event,control.dataset.incomeId);if(action==='add-past')window.addPastIncome(event);if(action==='add-raise')window.addIncomeRaise(event);if(action==='apply')window.applyIncomeRanges(event); });
    render();
  })();

  (() => {
    const categoryPalette = { groceries:'#efb43b', dining:'#78b575', spending:'#4d96b7', travel:'#779fc2' };
    const categoryMonthsWithTravel = () => chartMonths().map(month => {
      const entryTotal = subcategory => round(data.entries
        .filter(entry => entry.month === month.id && entry.category === 'Shopping' && entry.subcategory === subcategory)
        .reduce((sum, entry) => sum + num(entry.final), 0));
      const dining = entryTotal('Dining');
      const travel = entryTotal('Travel');
      return { ...month, groceries:num(month.groceries), dining, travel, spendingOther:round(Math.max(0, num(month.spending) - dining - travel)) };
    });
    const renderCategoryBarsWithTravel = () => {
      document.getElementById('categoryBarsChart')?.remove();
      const months = categoryMonthsWithTravel();
      const chart = document.createElement('article');
      chart.id = 'categoryBarsChart';
      chart.className = 'chart-card category-bars-chart';
      const chartAreaEl = document.getElementById('chartArea');
      if (!chartAreaEl) return;
      if (!months.length) { chart.innerHTML = '<div class="chart-card-head"><div><h3>Spending by category</h3></div></div><div class="chart-empty">No monthly data yet.</div>'; chartAreaEl.append(chart); return; }
      const height=360,left=58,right=20,top=22,bottom=56,minGroupWidth=96;
      const width=Math.max(1040, left+right+months.length*minGroupWidth);
      const plotWidth=width-left-right,plotHeight=height-top-bottom;
      const maxValue=Math.max(1,...months.flatMap(month=>[month.groceries+month.dining,month.spendingOther,month.travel]));
      const tickStep=Math.max(100,Math.ceil(maxValue/4/100)*100),topTick=tickStep*4;
      const y=value=>top+plotHeight-value/topTick*plotHeight,groupWidth=plotWidth/months.length,barWidth=26,gap=6,foodGap=2;
      const monthLabel=month=>({name:monthLabels[Number(month.id.slice(5,7))-1].slice(0,3),year:month.id.slice(2,4)});
      const bars=months.map((month,index)=>{
        const center=left+groupWidth*index+groupWidth/2,foodX=center-(barWidth*1.5+gap),spendingX=foodX+barWidth+gap,travelX=spendingX+barWidth+gap;
        const groceryY=y(month.groceries),diningY=y(month.groceries+month.dining),groceryHeight=Math.max(0,top+plotHeight-groceryY),diningHeight=Math.max(0,top+plotHeight-diningY),spendingHeight=Math.max(0,top+plotHeight-y(month.spendingOther)),travelHeight=Math.max(0,top+plotHeight-y(month.travel)),diningBarHeight=Math.max(0,diningHeight-(month.dining&&month.groceries?foodGap:0)),label=monthLabel(month);
        return `<g class="category-bar-group"><rect class="category-bar" x="${foodX}" y="${groceryY}" width="${barWidth}" height="${groceryHeight}" fill="${categoryPalette.groceries}"><title>${month.label}\nGroceries: ${money(month.groceries)}</title></rect>${month.dining?`<rect class="category-bar" x="${foodX}" y="${diningY}" width="${barWidth}" height="${diningBarHeight}" fill="${categoryPalette.dining}"><title>${month.label}\nDining: ${money(month.dining)}</title></rect>`:''}<rect class="category-bar" x="${spendingX}" y="${y(month.spendingOther)}" width="${barWidth}" height="${spendingHeight}" fill="${categoryPalette.spending}"><title>${month.label}\nSpending: ${money(month.spendingOther)}</title></rect>${month.travel?`<rect class="category-bar" x="${travelX}" y="${y(month.travel)}" width="${barWidth}" height="${travelHeight}" fill="${categoryPalette.travel}"><title>${month.label}\nTravel: ${money(month.travel)}</title></rect>`:''}<text class="chart-axis-label category-bar-month" x="${center}" y="${height-31}" text-anchor="middle"><tspan x="${center}">${label.name}</tspan><tspan x="${center}" dy="13">${label.year}</tspan></text></g>`;
      }).join('');
      const ticks=[0,1,2,3,4].map(index=>{const value=tickStep*index;return `<g><line class="chart-grid-line" x1="${left}" x2="${width-right}" y1="${y(value)}" y2="${y(value)}"/><text class="chart-axis-label" x="${left-10}" y="${y(value)+4}" text-anchor="end">${money(value)}</text></g>`}).join('');
      chart.innerHTML=`<div class="chart-card-head"><div><h3>Spending by category</h3><p class="chart-subtitle">${chartRange==='all'?'All time':`${chartRange} year${chartRange==='1'?'':'s'}`}</p></div></div><div class="category-bar-viewport"><svg class="category-bar-svg" style="width:${width}px;min-width:${width}px" viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly spending by category, with dining and groceries, spending, and travel">${ticks}<line class="chart-axis" x1="${left}" x2="${width-right}" y1="${top+plotHeight}" y2="${top+plotHeight}"/>${bars}</svg></div><div class="category-bar-legend"><span><i style="background:${categoryPalette.groceries}"></i>Groceries</span><span><i style="background:${categoryPalette.dining}"></i>Dining</span><span><i style="background:${categoryPalette.spending}"></i>Spending</span><span><i style="background:${categoryPalette.travel}"></i>Travel</span></div>`;
      chartAreaEl.append(chart);
    };
    const previousRenderCharts = renderCharts;
    renderCharts = () => { previousRenderCharts(); renderCategoryBarsWithTravel(); };
    render();
  })();

  (() => {
    // GitHub Pages can retain index.html in a browser cache. Check the live
    // page once after load and move older copies onto the current release URL.
    const localRelease = Number(document.querySelector('meta[name="estuary-release"]')?.content || 0);
    const checkForRelease = async () => {
      try {
        const liveUrl = new URL(location.pathname, location.origin);
        liveUrl.searchParams.set('_estuary_release', String(Date.now()));
        const response = await fetch(liveUrl, { cache:'no-store', credentials:'same-origin' });
        if (!response.ok) return;
        const html = await response.text();
        const match = html.match(/<meta\s+name=["']estuary-release["']\s+content=["'](\d+)["']/i);
        const remoteRelease = Number(match?.[1] || 0);
        if (remoteRelease > localRelease) {
          const target = new URL(location.href);
          target.searchParams.set('v', String(remoteRelease));
          location.replace(target.href);
        }
      } catch (_) {
        // A failed check should never interrupt normal use of the app.
      }
    };
    window.setTimeout(checkForRelease, 1200);
  })();

  (() => {
    const billTabs = () => `<div class="bill-tabs">${[['all','All'],['water','Water'],['electricity','Electricity'],['gas','Gas']].map(([value,label]) => `<button class="${billMetric===value?'selected':''}" data-bill-series="${value}">${label}</button>`).join('')}</div>`;
    const priorBillsRender = renderCharts;
    renderCharts = () => {
      const selectedBillMetric = billMetric;
      // The existing chart renderer expects a named utility series. Render a
      // valid base chart first, then replace Bills when the aggregate is selected.
      if (selectedBillMetric === 'all') billMetric = 'water';
      priorBillsRender();
      billMetric = selectedBillMetric;
      const billsCard = document.querySelector('#chartArea .chart-grid .chart-card');
      if (!billsCard) return;
      if (selectedBillMetric === 'all') {
        const points = chartMonths().map(month => ({
          label:month.label,
          value:round(num(month.water) + num(month.electricity) + num(month.gas))
        }));
        billsCard.outerHTML = chartCard('Bills', points, '#45b8b0', billTabs());
      } else {
        const tabs = billsCard.querySelector('.bill-tabs');
        if (tabs) tabs.outerHTML = billTabs();
      }
    };
    render();
  })();

  (() => {
    let historyView = 'expenses';
    const historySection = document.getElementById('history');
    const historyHead = historySection?.querySelector('.history-head');
    const historyEntriesEl = document.getElementById('historyEntries');
    const historyCountEl = document.getElementById('historyCount');
    const extraIncomeDialog = document.getElementById('extraIncomeDialog');
    const extraIncomeForm = document.getElementById('extraIncomeForm');
    const extraIncomeAmount = document.getElementById('extraIncomeAmount');
    const extraIncomeMonth = document.getElementById('extraIncomeMonth');
    const extraIncomeCategory = document.getElementById('extraIncomeCategory');
    const extraIncomeDescription = document.getElementById('extraIncomeDescription');
    const extraIncomeDialogTitle = document.getElementById('extraIncomeDialogTitle');
    const extraIncomeDialogDescription = document.getElementById('extraIncomeDialogDescription');
    const saveExtraIncome = document.getElementById('saveExtraIncome');
    const headerAction = document.getElementById('addExpense');
    const openExpenseAction = headerAction?.onclick;
    const priorHistoryRender = renderHistory;
    const priorOpenNotes = openNotes;
    const priorMonthTable = monthTable;
    let editingExtraIncomeId = '';

    const incomeForMonth = monthId => data.extraIncome.filter(entry => entry.month === monthId);
    const mainHistoryIsActive = () => document.querySelector('.nav-tab.active')?.dataset.tab === 'history';
    const setIncomeCategory = category => {
      extraIncomeCategory.value = category;
      document.querySelectorAll('[data-extra-income-category]').forEach(button => button.classList.toggle('selected',button.dataset.extraIncomeCategory === category));
    };
    const openExtraIncome = (monthId = currentMonthKey(),entryId = '') => {
      const entry = entryId ? data.extraIncome.find(item => item.id === entryId) : null;
      editingExtraIncomeId = entry?.id || '';
      extraIncomeMonth.innerHTML = data.months.map(month => `<option value="${month.id}">${month.label}</option>`).join('');
      const selectedMonth = entry?.month || monthId;
      extraIncomeMonth.value = data.months.some(month => month.id === selectedMonth) ? selectedMonth : (active || data.months.at(-1)?.id || '');
      extraIncomeAmount.value = entry ? round(entry.amount) : '';
      extraIncomeDescription.value = entry?.description || '';
      setIncomeCategory(entry?.category || 'Signup Bonus');
      extraIncomeDialogTitle.textContent = entry ? 'Edit extra income' : 'Add extra income';
      extraIncomeDialogDescription.textContent = entry ? 'Changes to the amount or month will automatically update Spending.' : 'This amount will be subtracted from Spending for the selected month.';
      saveExtraIncome.textContent = entry ? 'Save changes' : 'Add extra income';
      extraIncomeDialog.showModal();
      requestAnimationFrame(() => extraIncomeAmount.focus());
    };
    const syncHeaderAction = () => {
      if (!headerAction) return;
      const addsIncome = mainHistoryIsActive() && historyView === 'income';
      headerAction.textContent = addsIncome ? '+ Add extra income' : '+ Add expense';
      headerAction.onclick = addsIncome ? () => openExtraIncome() : openExpenseAction;
    };
    const setupHistoryTabs = () => {
      if (!historySection || document.getElementById('historyViewControls')) return;
      if (historyHead?.querySelector('h2')) historyHead.querySelector('h2').textContent = 'History';
      const controls = document.createElement('div');
      controls.id = 'historyViewControls';
      controls.className = 'history-view-controls';
      controls.innerHTML = '<div class="history-view-tabs" role="tablist" aria-label="History type"><button type="button" class="history-view-tab active" data-history-view="expenses" role="tab" aria-selected="true">Expenses</button><button type="button" class="history-view-tab" data-history-view="income" role="tab" aria-selected="false">Extra Income</button></div>';
      historyHead?.insertAdjacentElement('afterend',controls);
      controls.addEventListener('click',event => {
        const tab = event.target.closest('[data-history-view]');
        if (tab) {
          historyView = tab.dataset.historyView;
          renderHistory();
        }
      });
    };
    const updateHistoryControls = () => {
      document.querySelectorAll('[data-history-view]').forEach(button => {
        const selected = button.dataset.historyView === historyView;
        button.classList.toggle('active',selected);
        button.setAttribute('aria-selected',String(selected));
      });
      document.getElementById('historyFilter')?.classList.toggle('hidden',historyView !== 'expenses');
      syncHeaderAction();
    };
    const renderExtraIncomeHistory = () => {
      const legacyEntries = data.months.filter(month => num(month.cashOffset) > 0).map(month => ({id:`legacy-${month.id}`,month:month.id,amount:num(month.cashOffset),category:'Misc',createdAt:`${month.id}-01T00:00:00.000Z`,legacy:true}));
      const sorted = [...data.extraIncome,...legacyEntries].sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      historyCountEl.textContent = `${sorted.length} entr${sorted.length === 1 ? 'y' : 'ies'}`;
      historyEntriesEl.innerHTML = sorted.length ? sorted.map(entry => {
        const created = new Date(entry.createdAt);
        const monthLabel = data.months.find(month => month.id === entry.month)?.label || entry.month;
        const date = entry.legacy ? 'Legacy entry' : created.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
        const time = entry.legacy ? 'Imported total' : created.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
        const action = entry.legacy ? '<span class="history-legacy-label">Read only</span>' : `<button type="button" class="history-icon-button" data-edit-extra-income="${entry.id}" aria-label="Edit extra income"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10.4-10.4a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z"/><path d="m13.9 7.2 3 3"/></svg></button><button type="button" class="history-icon-button history-delete" data-delete-extra-income="${entry.id}" aria-label="Delete extra income"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M9 7l.7-3h4.6L15 7m-8 0 1 13h8l1-13"/></svg></button>`;
        return `<article class="history-entry extra-income-entry"><span class="history-date"><b>${date}</b><time datetime="${created.toISOString()}">${time}</time></span><span class="history-kind"><b>${entry.category}</b><span>${monthLabel}</span></span><b class="history-final extra-income-value">+${money(entry.amount)}</b><div class="history-actions">${action}</div>${entry.description?`<p class="history-comment">${escapeHtml(entry.description)}</p>`:''}</article>`;
      }).join('') : '<div class="chart-empty">Extra income you add will appear here.</div>';
    };

    setupHistoryTabs();
    renderHistory = () => {
      setupHistoryTabs();
      if (historyView === 'expenses') priorHistoryRender();
      else renderExtraIncomeHistory();
      if (historyHead?.querySelector('h2')) historyHead.querySelector('h2').textContent = 'History';
      updateHistoryControls();
    };
    monthTable = months => priorMonthTable(months).replaceAll('Add cash offset','Add extra income');
    addCashOffset = monthId => openExtraIncome(monthId);
    openNotes = monthId => {
      priorOpenNotes(monthId);
      const panel = document.getElementById('notesExtraIncome');
      const entries = incomeForMonth(monthId);
      const legacyAmount = num(data.months.find(month => month.id === monthId)?.cashOffset);
      const rows = [...entries.map(entry => `<div><span>${entry.category}</span><strong>+${money(entry.amount)}</strong>${entry.description?`<small>${escapeHtml(entry.description)}</small>`:''}</div>`),...(legacyAmount > 0 ? [`<div><span>Legacy extra income</span><strong>+${money(legacyAmount)}</strong></div>`] : [])];
      panel.classList.toggle('hidden',!rows.length);
      panel.innerHTML = rows.length ? `<p class="eyebrow">EXTRA INCOME</p>${rows.join('')}` : '';
    };

    document.getElementById('extraIncomeCategories')?.addEventListener('click',event => {
      const button = event.target.closest('[data-extra-income-category]');
      if (button) setIncomeCategory(button.dataset.extraIncomeCategory);
    });
    document.getElementById('closeExtraIncome').onclick = () => extraIncomeDialog.close();
    document.getElementById('cancelExtraIncome').onclick = () => extraIncomeDialog.close();
    extraIncomeDialog.addEventListener('click',event => { if (event.target === extraIncomeDialog) extraIncomeDialog.close(); });
    extraIncomeForm.addEventListener('submit',event => {
      event.preventDefault();
      const amount = num(extraIncomeAmount.value);
      const month = data.months.find(item => item.id === extraIncomeMonth.value);
      if (!(amount > 0) || !month) return;
      const existing = editingExtraIncomeId ? data.extraIncome.find(item => item.id === editingExtraIncomeId) : null;
      const entry = normalizeExtraIncomeRecord({id:existing?.id || crypto.randomUUID(),amount,month:month.id,category:extraIncomeCategory.value,description:extraIncomeDescription.value.trim(),createdAt:existing?.createdAt || new Date().toISOString(),updatedAt:existing ? new Date().toISOString() : undefined});
      if (!entry) return;
      if (existing) {
        const previous = {...existing};
        const oldMonth = data.months.find(item => item.id === previous.month);
        if (oldMonth) oldMonth.spending = round(oldMonth.spending+previous.amount);
        month.spending = round(month.spending-entry.amount);
        data.extraIncome[data.extraIncome.findIndex(item => item.id === existing.id)] = entry;
        updateCloudExtraIncome(previous,entry);
      } else {
        month.spending = round(month.spending-entry.amount);
        data.extraIncome.unshift(entry);
        addCloudExtraIncome(entry);
      }
      active = month.id;
      historyView = 'income';
      save();
      extraIncomeDialog.close();
      notice.textContent = existing ? 'Extra income updated.' : `${money(entry.amount)} in extra income was subtracted from ${month.label} spending.`;
      render();
    });
    document.addEventListener('click',event => {
      const editButton = event.target.closest?.('[data-edit-extra-income]');
      if (editButton) {
        openExtraIncome(currentMonthKey(),editButton.dataset.editExtraIncome);
        return;
      }
      const button = event.target.closest?.('[data-delete-extra-income]');
      if (!button) return;
      const entry = data.extraIncome.find(item => item.id === button.dataset.deleteExtraIncome);
      if (!entry || !confirm('Delete this extra income entry? Its amount will be added back to Spending.')) return;
      const month = data.months.find(item => item.id === entry.month);
      if (month) month.spending = round(month.spending+entry.amount);
      data.extraIncome = data.extraIncome.filter(item => item.id !== entry.id);
      save();
      deleteCloudExtraIncome(entry);
      render();
    });
    document.addEventListener('click',event => {
      if (event.target.closest?.('.nav-tab')) requestAnimationFrame(syncHeaderAction);
    });
    const priorRender = render;
    render = () => {
      priorRender();
      document.querySelectorAll('[data-notes-month]').forEach(button => {
        const monthId = button.dataset.notesMonth;
        const hasExtraIncome = incomeForMonth(monthId).length > 0 || num(data.months.find(month => month.id === monthId)?.cashOffset) > 0;
        if (hasExtraIncome) button.classList.add('has-notes');
        button.title = hasExtraIncome || data.months.find(month => month.id === monthId)?.notes ? 'View notes and extra income' : 'Add notes';
      });
      syncHeaderAction();
    };
    render();
  })();


  (() => {
    const section=document.getElementById('investments');
    const summary=document.getElementById('investmentSummary');
    const accountGrid=document.getElementById('investmentAccountGrid');
    const entriesHost=document.getElementById('investmentEntries');
    const count=document.getElementById('investmentCount');
    const settingsHost=document.getElementById('investmentAccountSettings');
    const investmentDialog=document.getElementById('investmentDialog');
    const investmentForm=document.getElementById('investmentForm');
    const amountInput=document.getElementById('investmentAmount');
    const dateInput=document.getElementById('investmentDate');
    const accountInput=document.getElementById('investmentAccount');
    const descriptionInput=document.getElementById('investmentDescription');
    const dialogTitle=document.getElementById('investmentDialogTitle');
    const saveButton=document.getElementById('saveInvestment');
    const totalsDialog=document.getElementById('investmentTotalsDialog');
    const totalsForm=document.getElementById('investmentTotalsForm');
    const totalsFields=document.getElementById('investmentTotalFields');
    const accountDialog=document.getElementById('investmentAccountDialog');
    const accountForm=document.getElementById('investmentAccountForm');
    const newAccountName=document.getElementById('newInvestmentAccountName');
    const newAccountType=document.getElementById('newInvestmentAccountType');
    const headerAction=document.getElementById('addExpense');
    const expenseHeaderAction=headerAction?.onclick;
    const editIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10.4-10.4a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z"/><path d="m13.9 7.2 3 3"/></svg>';
    const deleteIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M9 7l.7-3h4.6L15 7m-8 0 1 13h8l1-13"/></svg>';
    const palette=['#35b9b1','#efb43b','#779fc2','#f0845c','#a58bd4','#66a865','#d8759d','#6f91de'];
    let editingInvestmentId='',chartSequence=0;

    const localToday=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`};
    const colorAt=index=>palette[index%palette.length];
    const accountById=id=>data.settings.investmentAccounts.find(account=>account.id===id);
    const activeAccounts=()=>data.settings.investmentAccounts.filter(account=>!account.archived);
    const is401k=account=>account?.type==='401k';
    const isSavings=account=>account?.type==='Savings';
    const contributions=()=>data.investments.filter(entry=>entry.contributionType==='Your contribution'&&entry.amount>0);
    const balances=accountId=>data.investmentBalances.filter(entry=>entry.accountId===accountId).sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.updatedAt||a.createdAt).localeCompare(String(b.updatedAt||b.createdAt)));
    const latestBalance=accountId=>balances(accountId).at(-1);
    const currentAccountTotal=account=>num(latestBalance(account.id)?.total??account.currentTotal);
    const inferred401kMonths=year=>{const now=new Date(),current=now.getFullYear(),numeric=Number(year);return numeric<current?12:numeric>current?0:now.getMonth()+1};
    const accountYearContribution=(account,year)=>isSavings(account)?0:is401k(account)?round(num(account.yearlyContribution)/12*inferred401kMonths(year)):round(contributions().filter(entry=>entry.accountId===account.id&&entry.date.startsWith(year)).reduce((sum,entry)=>sum+entry.amount,0));
    const contributionPoints=(account,year)=>Array.from({length:12},(_,index)=>{const month=`${year}-${String(index+1).padStart(2,'0')}`,available=!is401k(account)||index<inferred401kMonths(year),value=is401k(account)&&available?round(num(account.yearlyContribution)/12):is401k(account)?0:round(contributions().filter(entry=>entry.accountId===account.id&&entry.date.startsWith(month)).reduce((sum,entry)=>sum+entry.amount,0));return{label:`${monthLabels[index].slice(0,3)} ${year}`,value}});
    const balancePoints=account=>{const monthly=new Map();balances(account.id).forEach(entry=>monthly.set(entry.date.slice(0,7),entry));return[...monthly.entries()].map(([month,entry])=>({label:new Date(`${month}-01T12:00:00`).toLocaleDateString('en-US',{month:'short',year:'numeric'}),value:num(entry.total)}))};
    const axisMoney=value=>{const absolute=Math.abs(value),formatted=absolute>=1000000?`${round(value/1000000)}M`:absolute>=1000?`${round(value/1000)}k`:String(round(value));return displayMode?maskDigits(`$${formatted}`):`$${formatted}`};
    const investmentLineChart=(points,color,label,emptyText)=>{
      if(!points.length)return `<div class="investment-chart-empty">${emptyText}</div>`;
      const width=520,height=180,left=48,right=12,top=12,bottom=28,plotWidth=width-left-right,plotHeight=height-top-bottom,max=Math.max(1,...points.map(point=>point.value)),x=index=>points.length===1?left:left+index*plotWidth/(points.length-1),y=value=>top+(max-value)*plotHeight/max,path=points.map((point,index)=>`${index?'L':'M'} ${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`).join(' '),indexes=[...new Set([0,Math.floor((points.length-1)/2),points.length-1])],gradientId=`investment-fill-${chartSequence++}`;
      return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(label)}"><defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".2"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${[max,max/2,0].map(value=>`<g><line class="investment-chart-grid" x1="${left}" x2="${width-right}" y1="${y(value)}" y2="${y(value)}"/><text class="investment-chart-axis" x="${left-7}" y="${y(value)+4}" text-anchor="end">${axisMoney(value)}</text></g>`).join('')}<path d="${path} L ${x(points.length-1)} ${height-bottom} L ${x(0)} ${height-bottom} Z" fill="url(#${gradientId})"/><path d="${path}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${points.map((point,index)=>`<circle cx="${x(index)}" cy="${y(point.value)}" r="4" fill="${color}"><title>${escapeHtml(point.label)}: ${money(point.value)}</title></circle>`).join('')}${indexes.map(index=>`<text class="investment-chart-axis" x="${x(index)}" y="${height-8}" text-anchor="middle">${escapeHtml(points[index].label)}</text>`).join('')}</svg>`;
    };
    const pieStyle=(values,colorIndexes=values.map((_,index)=>index))=>{const total=values.reduce((sum,value)=>sum+value,0);if(!total)return'var(--soft)';let start=0;return`conic-gradient(${values.map((value,index)=>{const from=start;start+=value/total*100;return`${colorAt(colorIndexes[index])} ${from}% ${start}%`}).join(',')})`};
    const pieCard=(title,subtitle,accounts,values,colorIndexes=accounts.map((_,index)=>index))=>{const total=round(values.reduce((sum,value)=>sum+value,0));return `<article class="investment-summary-card"><div><h3>${title}</h3><p>${subtitle}</p><div class="investment-legend">${accounts.map((account,index)=>`<span><i style="--legend-color:${colorAt(colorIndexes[index])}"></i>${escapeHtml(account.name)} · ${money(values[index])}</span>`).join('')}</div></div><div class="investment-donut" style="--investment-pie:${pieStyle(values,colorIndexes)}" role="img" aria-label="${escapeHtml(title)}: ${money(total)}"><strong class="investment-donut-total">${money(total)}</strong></div></article>`};
    const selectInvestmentAccount=id=>{accountInput.value=id;document.querySelectorAll('[data-investment-account]').forEach(button=>button.classList.toggle('selected',button.dataset.investmentAccount===id))};
    const eligibleContributionAccounts=()=>activeAccounts().filter(account=>!is401k(account)&&!isSavings(account));
    const renderAccountOptions=()=>{const host=document.getElementById('investmentAccountOptions'),eligible=eligibleContributionAccounts();host.innerHTML=eligible.map(account=>`<button type="button" class="choice-option" data-investment-account="${account.id}">${escapeHtml(account.name)}</button>`).join('');return eligible};
    const openInvestment=(entryId='')=>{const entry=entryId?data.investments.find(item=>item.id===entryId):null,eligible=renderAccountOptions();if(!entry&&!eligible.length){alert('Add an active IRA or Brokerage account in Investment Settings first.');return}editingInvestmentId=entry?.id||'';amountInput.value=entry?round(entry.amount):'';dateInput.value=entry?.date||localToday();descriptionInput.value=entry?.description||'';selectInvestmentAccount(entry?.accountId||eligible[0]?.id||'');dialogTitle.textContent=entry?'Edit investment':'Add investment';saveButton.textContent=entry?'Save changes':'Add investment';investmentDialog.showModal();requestAnimationFrame(()=>amountInput.focus())};
    const openTotals=()=>{const accounts=activeAccounts();if(!accounts.length){alert('Add an investment account first.');return}totalsFields.innerHTML=accounts.map(account=>`<label><span>${escapeHtml(account.name)}<small>${escapeHtml(account.type)}</small></span><input type="number" min="0" step="0.01" inputmode="decimal" data-balance-account="${account.id}" placeholder="${round(currentAccountTotal(account))}" aria-label="Current total for ${escapeHtml(account.name)}"></label>`).join('');totalsDialog.showModal();requestAnimationFrame(()=>totalsFields.querySelector('input')?.focus())};
    const accountCharts=(account,year,color)=>{const showContributions=account.type==='Brokerage';return `<div class="investment-account-charts${showContributions?'':' single'}">${showContributions?`<section class="investment-chart"><h4>Contributions · ${year}</h4><p>Monthly cash contributions</p>${investmentLineChart(contributionPoints(account,year),color,`${account.name} monthly contributions for ${year}`,'Contributions will appear here.')}</section>`:''}<section class="investment-chart"><h4>Total amount</h4><p>Entire monthly balance history</p>${investmentLineChart(balancePoints(account),color,`${account.name} total balance over time`,'Use Update totals to begin this graph.')}</section></div>`};
    const settingsRow=(account,index,total)=>{const goalField=is401k(account)?'yearlyContribution':'annualGoal',goalLabel=is401k(account)?'Yearly Contribution':'Yearly Goal',goalValue=round(account[goalField]),name=escapeHtml(account.name),goalControl=isSavings(account)?'<div class="investment-settings-goal-spacer" aria-hidden="true"></div>':`<label>${goalLabel}<input type="number" min="0" step="0.01" inputmode="decimal" value="${goalValue}" data-investment-setting="${goalField}" data-investment-account-id="${account.id}"></label>`;return `<div class="investment-settings-row${account.archived?' is-archived':''}"><label>Account name<input type="text" maxlength="60" value="${name}" data-investment-setting="name" data-investment-account-id="${account.id}"></label><label>Type<select data-investment-setting="type" data-investment-account-id="${account.id}">${investmentAccountTypes.map(type=>`<option${account.type===type?' selected':''}>${type}</option>`).join('')}</select></label>${goalControl}<div class="investment-settings-actions"><button type="button" class="button ghost investment-order-button" data-move-investment-account="${account.id}" data-direction="-1" aria-label="Move ${name} up" title="Move up"${index===0?' disabled':''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg></button><button type="button" class="button ghost investment-order-button" data-move-investment-account="${account.id}" data-direction="1" aria-label="Move ${name} down" title="Move down"${index===total-1?' disabled':''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><button type="button" class="button ghost investment-archive-button" data-archive-investment-account="${account.id}">${account.archived?'Restore':'Archive'}</button></div></div>`};
    const moveInvestmentAccount=(id,direction)=>{const account=accountById(id);if(!account)return;const peers=data.settings.investmentAccounts.filter(item=>item.archived===account.archived),peerIndex=peers.findIndex(item=>item.id===id),target=peers[peerIndex+direction];if(!target)return;const from=data.settings.investmentAccounts.findIndex(item=>item.id===id),to=data.settings.investmentAccounts.findIndex(item=>item.id===target.id);[data.settings.investmentAccounts[from],data.settings.investmentAccounts[to]]=[data.settings.investmentAccounts[to],data.settings.investmentAccounts[from]];save();syncInvestmentSettings();render()};
    const renderInvestments=()=>{
      if(!section)return;chartSequence=0;const today=localToday(),year=today.slice(0,4),month=today.slice(0,7),accounts=activeAccounts(),contributionAccounts=accounts.filter(account=>!isSavings(account)),contributionValues=contributionAccounts.map(account=>accountYearContribution(account,year)),contributionColorIndexes=contributionAccounts.map(account=>accounts.indexOf(account)),balanceValues=accounts.map(currentAccountTotal);
      summary.innerHTML=pieCard('Total Portfolio Value','Latest balance update',accounts,balanceValues)+pieCard('Total Added This Year',`Cash contributions through ${new Date(`${month}-01T12:00:00`).toLocaleDateString('en-US',{month:'long'})}`,contributionAccounts,contributionValues,contributionColorIndexes);
      accountGrid.innerHTML=accounts.length?accounts.map((account,index)=>{const yearContribution=accountYearContribution(account,year),currentTotal=balanceValues[index],goal=is401k(account)?num(account.yearlyContribution):num(account.annualGoal),progress=!is401k(account)&&goal?Math.min(100,yearContribution/goal*100):0,color=colorAt(index),secondaryStats=goal>0?`<span class="investment-account-stat"><span>Added this year</span><strong>${money(yearContribution)}</strong></span><span class="investment-account-stat"><span>${is401k(account)?'Yearly contribution':'Yearly goal'}</span><strong>${money(goal)}</strong></span>`:'';if(isSavings(account))return `<article class="investment-account-card investment-savings-card"><div class="investment-account-info"><div class="investment-account-heading"><h3>${escapeHtml(account.name)}</h3><span class="investment-account-type">${escapeHtml(account.type)}</span></div><div class="investment-account-stats"><span class="investment-account-stat balance"><span>Current balance</span><strong>${money(currentTotal)}</strong></span></div></div></article>`;return `<article class="investment-account-card"><div class="investment-account-info"><div class="investment-account-heading"><h3>${escapeHtml(account.name)}</h3><span class="investment-account-type">${escapeHtml(account.type)}</span></div><div class="investment-account-stats"><span class="investment-account-stat balance"><span>Current balance</span><strong>${money(currentTotal)}</strong></span>${secondaryStats}</div></div>${!is401k(account)&&goal?`<div class="investment-progress" aria-label="${Math.round(progress)}% of yearly goal"><i style="width:${progress}%;background:${color}"></i></div><p class="investment-goal-label"><span>${Math.round(progress)}%</span><span>${money(goal)}</span></p>`:''}${accountCharts(account,year,color)}</article>`}).join(''):'<div class="chart-empty">Add an investment account in Investment Settings.</div>';
      const sorted=[...contributions()].sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.createdAt).localeCompare(String(a.createdAt)));count.textContent=`${sorted.length} contribution${sorted.length===1?'':'s'}`;entriesHost.innerHTML=sorted.length?sorted.map(entry=>{const account=accountById(entry.accountId),date=new Date(`${entry.date}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});return `<article class="history-entry investment-entry"><span class="history-date"><b>${date}</b><time>Your contribution</time></span><span class="history-kind"><b>${escapeHtml(account?.name||'Archived account')}</b><span>${escapeHtml(account?.type||'Account')}</span></span><b class="history-final">${money(entry.amount)}</b><div class="history-actions"><button type="button" class="history-icon-button" data-edit-investment="${entry.id}" aria-label="Edit investment">${editIcon}</button><button type="button" class="history-icon-button history-delete" data-delete-investment="${entry.id}" aria-label="Delete investment">${deleteIcon}</button></div>${entry.description?`<p class="history-comment">${escapeHtml(entry.description)}</p>`:''}</article>`}).join(''):'<div class="chart-empty">Investments you add will appear here.</div>';
      const active=data.settings.investmentAccounts.filter(account=>!account.archived),archived=data.settings.investmentAccounts.filter(account=>account.archived),renderSettingsRows=accounts=>accounts.map((account,index)=>settingsRow(account,index,accounts.length)).join('');settingsHost.innerHTML=renderSettingsRows(active)+(archived.length?`<h4 class="investment-archived-heading">Archived</h4>${renderSettingsRows(archived)}`:'');
    };
    const syncHeaderAction=()=>{if(!headerAction)return;const activeTab=document.querySelector('.nav-tab.active')?.dataset.tab;if(activeTab==='investments'){headerAction.textContent='+ Add investment';headerAction.onclick=()=>openInvestment()}else if(headerAction.textContent==='+ Add investment'){headerAction.textContent='+ Add expense';headerAction.onclick=expenseHeaderAction}};

    document.getElementById('investmentAccountOptions')?.addEventListener('click',event=>{const button=event.target.closest('[data-investment-account]');if(button)selectInvestmentAccount(button.dataset.investmentAccount)});
    document.getElementById('closeInvestment').onclick=()=>investmentDialog.close();document.getElementById('cancelInvestment').onclick=()=>investmentDialog.close();investmentDialog.addEventListener('click',event=>{if(event.target===investmentDialog)investmentDialog.close()});
    investmentForm.addEventListener('submit',event=>{event.preventDefault();const existing=editingInvestmentId?data.investments.find(item=>item.id===editingInvestmentId):null,entry=normalizeInvestmentRecord({id:existing?.id||crypto.randomUUID(),accountId:accountInput.value,date:dateInput.value,amount:num(amountInput.value),contributionType:'Your contribution',description:descriptionInput.value.trim(),createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:existing?new Date().toISOString():undefined});if(!entry)return;if(existing)data.investments[data.investments.findIndex(item=>item.id===existing.id)]=entry;else data.investments.unshift(entry);save();syncInvestmentRecord(entry);investmentDialog.close();render()});
    entriesHost.addEventListener('click',event=>{const edit=event.target.closest('[data-edit-investment]'),remove=event.target.closest('[data-delete-investment]');if(edit)openInvestment(edit.dataset.editInvestment);if(remove){const entry=data.investments.find(item=>item.id===remove.dataset.deleteInvestment);if(!entry||!confirm('Delete this investment contribution?'))return;data.investments=data.investments.filter(item=>item.id!==entry.id);save();deleteCloudInvestment(entry.id);render()}});
    document.getElementById('updateInvestmentTotals').onclick=event=>{event.preventDefault();event.stopPropagation();openTotals()};document.getElementById('closeInvestmentTotals').onclick=()=>totalsDialog.close();document.getElementById('cancelInvestmentTotals').onclick=()=>totalsDialog.close();totalsDialog.addEventListener('click',event=>{if(event.target===totalsDialog)totalsDialog.close()});
    totalsForm.addEventListener('submit',event=>{event.preventDefault();const date=localToday(),now=new Date().toISOString(),records=[...totalsFields.querySelectorAll('[data-balance-account]')].map(input=>{const account=accountById(input.dataset.balanceAccount),raw=input.value.trim(),total=raw===''?currentAccountTotal(account):safeNumber(raw,0),existing=data.investmentBalances.find(item=>item.accountId===account.id&&item.date===date);return normalizeInvestmentBalanceRecord({id:existing?.id||`${account.id}-${date}`,accountId:account.id,date,total,createdAt:existing?.createdAt||now,updatedAt:existing?now:undefined})}).filter(Boolean);records.forEach(record=>{const index=data.investmentBalances.findIndex(item=>item.accountId===record.accountId&&item.date===record.date);if(index>=0)data.investmentBalances[index]=record;else data.investmentBalances.push(record);syncInvestmentBalanceRecord(record)});save();totalsDialog.close();render()});
    document.getElementById('addInvestmentAccount').onclick=()=>{accountForm.reset();newAccountType.value='IRA';accountDialog.showModal();requestAnimationFrame(()=>newAccountName.focus())};document.getElementById('closeInvestmentAccount').onclick=()=>accountDialog.close();document.getElementById('cancelInvestmentAccount').onclick=()=>accountDialog.close();accountDialog.addEventListener('click',event=>{if(event.target===accountDialog)accountDialog.close()});
    accountForm.addEventListener('submit',event=>{event.preventDefault();const account=normalizeInvestmentAccount({id:`investment-account-${crypto.randomUUID()}`,name:newAccountName.value,type:newAccountType.value,annualGoal:0,yearlyContribution:0,currentTotal:0,archived:false,createdAt:new Date().toISOString()});if(!account)return;data.settings.investmentAccounts.push(account);save();syncInvestmentSettings();accountDialog.close();render()});
    settingsHost.addEventListener('change',event=>{const input=event.target.closest('[data-investment-setting]');if(!input)return;const account=accountById(input.dataset.investmentAccountId);if(!account)return;const field=input.dataset.investmentSetting;if(field==='name')account.name=safeText(input.value||'Account',60).trim()||'Account';else if(field==='type'&&investmentAccountTypes.includes(input.value)){account.type=input.value;if(is401k(account))account.annualGoal=0;else account.yearlyContribution=0;if(isSavings(account))account.annualGoal=0}else account[field]=safeNumber(input.value,0);save();syncInvestmentSettings();render()});
    settingsHost.addEventListener('click',event=>{const move=event.target.closest('[data-move-investment-account]');if(move){moveInvestmentAccount(move.dataset.moveInvestmentAccount,Number(move.dataset.direction));return}const button=event.target.closest('[data-archive-investment-account]');if(!button)return;const account=accountById(button.dataset.archiveInvestmentAccount);if(!account)return;if(!account.archived&&!confirm(`Archive ${account.name}? Its contribution and balance history will be preserved.`))return;account.archived=!account.archived;save();syncInvestmentSettings();render()});
    document.addEventListener('click',event=>{if(event.target.closest?.('.nav-tab'))requestAnimationFrame(syncHeaderAction)});
    const previousRender=render;render=()=>{previousRender();renderInvestments();syncHeaderAction();if(displayMode)applyDisplayMode()};renderInvestments();syncHeaderAction();if(displayMode)applyDisplayMode();
  })();

  (() => {
    let spendingMetric = 'all';
    const trackedCategoryStart = '2027-09';
    const historicTravel = {
      '2021': { total:3000, months:12 },
      '2022': { total:4500, months:12 },
      '2023': { total:13000, months:12 },
      '2024': { total:15300, months:12 },
      '2025': { total:18000, months:12 },
      '2026': { total:15700, months:9 }
    };

    const historicalTravelForMonth = monthId => {
      const history = historicTravel[monthId.slice(0,4)];
      const monthNumber = Number(monthId.slice(5,7));
      if (!history || monthNumber > history.months) return 0;
      const baseCents = Math.floor(history.total * 100 / history.months);
      const cents = monthNumber === history.months
        ? history.total * 100 - baseCents * (history.months - 1)
        : baseCents;
      return cents / 100;
    };
    const trackedSpendingCategory = (monthId, subcategory) => round(data.entries
      .filter(entry => entry.month === monthId && entry.type === 'Spending' && entry.subcategory === subcategory)
      .reduce((sum, entry) => sum + num(entry.final), 0));
    const trackedDining = monthId => round(data.entries
      .filter(entry => entry.month === monthId && entry.type === 'Spending' && entry.category === 'Dining')
      .reduce((sum, entry) => sum + num(entry.final), 0));
    const travelYearTotal = year => historicTravel[year]?.total ?? round(data.entries
      .filter(entry => entry.month.startsWith(`${year}-`) && entry.month >= trackedCategoryStart && entry.type === 'Spending' && entry.subcategory === 'Travel')
      .reduce((sum, entry) => sum + num(entry.final), 0));
    const spendingPoints = metric => chartMonths().map(month => {
      let value = num(month.spending);
      if (metric === 'travel') value = month.id < trackedCategoryStart
        ? historicalTravelForMonth(month.id)
        : trackedSpendingCategory(month.id, 'Travel');
      if (metric === 'dining') value = month.id < trackedCategoryStart
        ? 0
        : trackedDining(month.id);
      const year = month.id.slice(0,4);
      const partialYear = historicTravel[year]?.months < 12 || year === currentMonthKey().slice(0,4);
      return {
        label:month.label,
        value:round(value),
        secondaryLabel:metric === 'travel' ? `${year} ${partialYear ? 'so far' : 'total'}` : '',
        secondaryValue:metric === 'travel' ? money(travelYearTotal(year)) : ''
      };
    });
    const spendingTabs = () => `<div class="bill-tabs spending-tabs">${[['all','All'],['travel','Travel'],['dining','Dining']].map(([value,label]) => `<button class="${spendingMetric===value?'selected':''}" data-spending-series="${value}">${label}</button>`).join('')}</div>`;

    const previousRenderCharts = renderCharts;
    renderCharts = () => {
      previousRenderCharts();
      document.getElementById('categoryBarsChart')?.remove();
      const spendingCard = [...document.querySelectorAll('#chartArea .chart-grid .chart-card')]
        .find(card => card.querySelector('h3')?.textContent.trim() === 'Spending');
      if (spendingCard) {
        const points = spendingPoints(spendingMetric);
        spendingCard.outerHTML = chartCard('Spending', points, '#f0845c', spendingTabs());
        if (spendingMetric === 'travel') {
          const replacement = [...document.querySelectorAll('#chartArea .chart-grid .chart-card')]
            .find(card => card.querySelector('h3')?.textContent.trim() === 'Spending');
          replacement?.querySelectorAll('.chart-point').forEach((point, index) => {
            point.dataset.chartSecondaryLabel = points[index]?.secondaryLabel || '';
            point.dataset.chartSecondaryValue = points[index]?.secondaryValue || '';
          });
        }
      }
    };
    document.addEventListener('click', event => {
      const button = event.target.closest?.('[data-spending-series]');
      if (!button) return;
      spendingMetric = button.dataset.spendingSeries;
      renderCharts();
    });
    render();
  })();

  (() => {
    showChartTooltip = (point, event) => {
      const secondaryLabel = point.dataset.chartSecondaryLabel || '3-month average';
      const secondaryValue = point.dataset.chartSecondaryValue || point.dataset.chartAverage;
      chartTooltip.innerHTML = `<b>${escapeHtml(point.dataset.chartLabel)}</b><span>${escapeHtml(point.dataset.chartValue)}</span><span>${escapeHtml(secondaryLabel)}: ${escapeHtml(secondaryValue)}</span>`;
      const gap=14,width=chartTooltip.offsetWidth,height=chartTooltip.offsetHeight;
      const left=Math.min(window.innerWidth-width-10,Math.max(10,event.clientX+gap));
      const top=Math.min(window.innerHeight-height-10,Math.max(10,event.clientY-height-gap));
      chartTooltip.style.left=`${left}px`;
      chartTooltip.style.top=`${top}px`;
      chartTooltip.classList.add('visible');
    };

    const insightHost = document.getElementById('overviewInsights');
    let insightSignature = '';
    let selectedInsights = [];
    const shuffled = values => {
      const copy = [...values];
      for (let index=copy.length-1; index>0; index--) {
        const swap = Math.floor(Math.random() * (index + 1));
        [copy[index],copy[swap]] = [copy[swap],copy[index]];
      }
      return copy;
    };
    const renderRandomInsights = () => {
      if (!insightHost) return;
      const current = currentMonthKey();
      const completed = data.months.filter(month => month.id < current).sort((a,b) => a.id.localeCompare(b.id));
      const latest = completed.at(-1);
      if (!latest) { insightHost.classList.add('hidden'); return; }
      const messages = [];
      const latestMonthName = monthLabels[Number(latest.id.slice(5,7))-1];
      const previousThree = completed.slice(-4,-1);
      if (previousThree.length === 3) {
        const average = previousThree.reduce((sum,month)=>sum+num(month.spending),0)/3;
        const difference = round(num(latest.spending)-average);
        if (Math.abs(difference)>=1) messages.push(`Spending in <b>${latestMonthName.slice(0,3)}</b> is <b>${money(Math.abs(difference))}</b> ${difference<0?'below':'above'} your three-month average.`);
      }
      const lastYearMonth = data.months.find(month=>month.id===`${Number(latest.id.slice(0,4))-1}-${latest.id.slice(5)}`);
      if (lastYearMonth && num(lastYearMonth.spending)>0) {
        const difference=round(num(latest.spending)-num(lastYearMonth.spending));
        if (Math.abs(difference)>=1) messages.push(`You spent <b>${money(Math.abs(difference))}</b> ${difference<0?'less':'more'} than last ${latestMonthName}.`);
      }
      if (lastYearMonth && num(lastYearMonth.groceries)>0) {
        const change=round((num(latest.groceries)-num(lastYearMonth.groceries))/num(lastYearMonth.groceries)*100);
        if (change) messages.push(`Food is <b>${Math.abs(change)}%</b> ${change>0?'above':'below'} last ${latestMonthName}.`);
      }
      const year=Number(latest.id.slice(0,4)),cutoff=latest.id.slice(5);
      const thisYear=completed.filter(month=>month.id.startsWith(`${year}-`)&&month.id.slice(5)<=cutoff);
      const savedToDate=thisYear.reduce((sum,month)=>sum+total(month).saved,0);
      const savedLastYear=data.months.filter(month=>month.id.startsWith(`${year-1}-`)&&month.id.slice(5)<=cutoff).reduce((sum,month)=>sum+total(month).saved,0);
      const savedDifference=round(savedToDate-savedLastYear);
      if (savedDifference) messages.push(`You've saved <b>${money(Math.abs(savedDifference))}</b> ${savedDifference>0?'more':'less'} than this point last year.`);
      if (savedToDate) messages.push(`You've saved <b>${money(savedToDate)}</b> so far in ${year}.`);
      if (thisYear.length) {
        const best=[...thisYear].sort((a,b)=>total(b).saved-total(a).saved)[0];
        messages.push(`<b>${monthLabels[Number(best.id.slice(5,7))-1]}</b> is your strongest savings month this year at <b>${money(total(best).saved)}</b>.`);
      }
      const recent=completed.slice(-12);
      if (recent.length>=3) {
        const lowest=[...recent].sort((a,b)=>num(a.spending)-num(b.spending))[0];
        messages.push(`<b>${lowest.label}</b> had your lowest Spending total in the last ${recent.length} months: <b>${money(lowest.spending)}</b>.`);
      }
      let streak=0;
      for (let index=completed.length-1; index>=0 && total(completed[index]).saved>0; index--) streak++;
      if (streak>=2) messages.push(`You've saved money for <b>${streak} completed months</b> in a row.`);
      const signature=messages.join('\n');
      if (signature!==insightSignature) {
        insightSignature=signature;
        selectedInsights=shuffled(messages).slice(0,3);
      }
      insightHost.innerHTML=selectedInsights.map(message=>`<p class="overview-insight">${message}</p>`).join('');
      insightHost.classList.toggle('hidden',!selectedInsights.length);
    };
    const previousRender=render;
    render=()=>{previousRender();renderRandomInsights();if(displayMode)applyDisplayMode()};
    renderRandomInsights();if(displayMode)applyDisplayMode();
  })();

  (() => {
    const previousMonthId = monthId => {
      const [year,month]=monthId.split('-').map(Number);
      const date=new Date(year,month-2,1);
      return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
    };
    const updateSavingsLatest = () => {
      const savingsCard=[...document.querySelectorAll('#chartArea .chart-grid .chart-card')]
        .find(card=>card.querySelector('h3')?.textContent.trim()==='Savings');
      const lastMonth=data.months.find(month=>month.id===previousMonthId(currentMonthKey()));
      const value=savingsCard?.querySelector('.chart-value');
      if(value)value.textContent=`Last month: ${money(lastMonth ? total(lastMonth).saved : 0)}`;
    };
    const previousRenderCharts=renderCharts;
    renderCharts=()=>{previousRenderCharts();updateSavingsLatest()};
    render();
  })();

  (() => {
    const highlightCurrentMonth = () => {
      document.querySelectorAll('.monthly-table tr.current-month-row').forEach(row=>row.classList.remove('current-month-row'));
      document.querySelector(`.monthly-table [data-month="${currentMonthKey()}"]`)?.closest('tr')?.classList.add('current-month-row');
    };
    const previousRender=render;
    render=()=>{previousRender();highlightCurrentMonth();if(displayMode)applyDisplayMode()};
    highlightCurrentMonth();
  })();

  (() => {
    const section=document.getElementById('accounts');
    const content=document.getElementById('accountsContent');
    const dialog=document.getElementById('accountDialog');
    const form=document.getElementById('accountForm');
    const title=document.getElementById('accountDialogTitle');
    const nameInput=document.getElementById('accountName');
    const kindInput=document.getElementById('accountKind');
    const useInput=document.getElementById('accountUse');
    const bonusInput=document.getElementById('accountSignupBonus');
    const statusInput=document.getElementById('accountStatus');
    const imageInput=document.getElementById('accountImageFile');
    const imagePreview=document.getElementById('accountImagePreview');
    const imageStatus=document.getElementById('accountImageStatus');
    const saveButton=document.getElementById('saveAccount');
    const headerAction=document.getElementById('addExpense');
    const defaultHeaderAction=headerAction?.onclick;
    const cardIcon='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M3 10h18M7 15h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
    let editingAccountId='';
    let draftSvg='';

    const svgUrl=svg=>svg?`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`:'';
    const artwork=(account,preview=false)=>account?.imageSvg?`<img src="${svgUrl(account.imageSvg)}" alt="${preview?'':'Artwork for '+escapeHtml(account.name)}">`:`<span class="account-placeholder">${cardIcon}</span>`;
    const selectKind=kind=>{kindInput.value=kind;document.querySelectorAll('[data-account-kind]').forEach(button=>button.classList.toggle('selected',button.dataset.accountKind===kind))};
    const renderPreview=()=>{imagePreview.innerHTML=artwork(draftSvg?{imageSvg:draftSvg,name:nameInput.value||'Account'}:null,true);document.getElementById('removeAccountImage').disabled=!draftSvg};
    const openAccount=(id='')=>{
      const account=id?data.accounts.find(item=>item.id===id):null;
      editingAccountId=account?.id||'';
      draftSvg=account?.imageSvg||'';
      nameInput.value=account?.name||'';
      useInput.value=account?.use||'';
      bonusInput.value=account?.signupBonus||'';
      statusInput.value=account?.status||'Active';
      selectKind(account?.kind||'Credit Card');
      title.textContent=account?'Edit account':'Add account';
      saveButton.textContent=account?'Save changes':'Add account';
      imageStatus.textContent='SVG only · maximum 100 KB';
      renderPreview();
      dialog.showModal();
      requestAnimationFrame(()=>nameInput.focus());
    };
    const editIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10.4-10.4a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z"/><path d="m13.9 7.2 3 3"/></svg>';
    const deleteIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M9 7l.7-3h4.6L15 7m-8 0 1 13h8l1-13"/></svg>';
    const cardMarkup=account=>`<article class="account-card"><div class="account-card-art">${artwork(account)}<div class="account-card-actions"><button type="button" class="account-card-action" data-edit-account="${account.id}" aria-label="Edit ${escapeHtml(account.name)}" title="Edit">${editIcon}</button><button type="button" class="account-card-action account-delete" data-delete-account="${account.id}" aria-label="Delete ${escapeHtml(account.name)}" title="Delete">${deleteIcon}</button></div></div><div class="account-card-body"><div class="account-card-title"><h4>${escapeHtml(account.name)}</h4></div>${account.use?`<p class="account-card-use">${escapeHtml(account.use)}</p>`:''}${account.signupBonus?`<div class="account-card-copy"><small>Signup bonus</small><p>${escapeHtml(account.signupBonus)}</p></div>`:''}</div></article>`;
    const groupMarkup=(kind,label)=>{
      const matching=data.accounts.filter(account=>account.kind===kind).sort((a,b)=>a.name.localeCompare(b.name)),active=matching.filter(account=>account.status==='Active'),closed=matching.filter(account=>account.status==='Closed');
      return `<section class="accounts-group"><div class="accounts-group-head"><h3>${label}</h3><span>${matching.length}</span></div>${active.length?`<div class="accounts-grid">${active.map(cardMarkup).join('')}</div>`:`<div class="accounts-empty">No active ${label.toLowerCase()} yet.</div>`}${closed.length?`<details class="accounts-closed"><summary>Closed · ${closed.length}</summary><div class="accounts-grid">${closed.map(cardMarkup).join('')}</div></details>`:''}</section>`;
    };
    const renderAccounts=()=>{if(content)content.innerHTML=groupMarkup('Credit Card','Credit Cards')+groupMarkup('Bank Account','Bank Accounts')};
    const syncHeaderAction=()=>{
      if(!headerAction)return;
      const activeTab=document.querySelector('.nav-tab.active')?.dataset.tab;
      if(activeTab==='accounts'){
        headerAction.textContent='+ Add account';
        headerAction.onclick=()=>openAccount();
      }else if(headerAction.textContent==='+ Add account'){
        headerAction.textContent='+ Add expense';
        headerAction.onclick=defaultHeaderAction;
      }
    };

    document.querySelector('.account-kind-options')?.addEventListener('click',event=>{const button=event.target.closest('[data-account-kind]');if(button)selectKind(button.dataset.accountKind)});
    imageInput.addEventListener('change',async()=>{
      const file=imageInput.files?.[0];imageInput.value='';if(!file)return;
      if(!file.name.toLowerCase().endsWith('.svg')&&file.type!=='image/svg+xml'){imageStatus.textContent='Choose an SVG file.';return}
      if(file.size>100000){imageStatus.textContent='That SVG is over the 100 KB limit.';return}
      const cleaned=sanitizeAccountSvgMarkup(await file.text());
      if(!cleaned){imageStatus.textContent='That SVG could not be safely imported.';return}
      draftSvg=cleaned;imageStatus.textContent='SVG cleaned and ready to save.';renderPreview();
    });
    document.getElementById('removeAccountImage').onclick=()=>{draftSvg='';imageStatus.textContent='Image removed. Save to apply.';renderPreview()};
    document.getElementById('closeAccount').onclick=()=>dialog.close();
    document.getElementById('cancelAccount').onclick=()=>dialog.close();
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
    form.addEventListener('submit',event=>{
      event.preventDefault();
      const existing=editingAccountId?data.accounts.find(item=>item.id===editingAccountId):null;
      const account=normalizeAccountRecord({id:existing?.id||crypto.randomUUID(),kind:kindInput.value,name:nameInput.value,use:useInput.value,signupBonus:bonusInput.value,status:statusInput.value,imageSvg:draftSvg,createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:existing?new Date().toISOString():undefined});
      if(!account)return;
      if(existing)data.accounts[data.accounts.findIndex(item=>item.id===existing.id)]=account;else data.accounts.push(account);
      save();syncAccountRecord(account);dialog.close();render();
    });
    content?.addEventListener('click',event=>{
      const edit=event.target.closest('[data-edit-account]'),remove=event.target.closest('[data-delete-account]');
      if(edit){openAccount(edit.dataset.editAccount);return}
      if(remove){const account=data.accounts.find(item=>item.id===remove.dataset.deleteAccount);if(!account||!confirm(`Delete ${account.name}?`))return;data.accounts=data.accounts.filter(item=>item.id!==account.id);save();deleteCloudAccount(account.id);render()}
    });
    document.addEventListener('click',event=>{if(event.target.closest?.('.nav-tab'))requestAnimationFrame(syncHeaderAction)});
    document.addEventListener('change',event=>{if(event.target?.id!=='restoreBackupFile')return;event.stopImmediatePropagation();restoreBackup(event).then(()=>firebaseClient&&firebaseUser?Promise.all([...data.accounts.map(syncAccountRecord),...data.investmentBalances.map(syncInvestmentBalanceRecord)]):null)},true);
    const previousRender=render;
    render=()=>{previousRender();renderAccounts();syncHeaderAction();if(displayMode)applyDisplayMode()};
    renderAccounts();syncHeaderAction();if(displayMode)applyDisplayMode();
  })();
