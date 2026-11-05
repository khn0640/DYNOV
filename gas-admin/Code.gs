/**
 * DYNOV restricted Google Apps Script admin.
 * Deploy separately as web app: Execute as Me, Access Only myself.
 * Set SPREADSHEET_ID in Script Properties. Never expose it to clients.
 */
const SHEET_NAME='자동견적문의';
const HEADERS={id:'의뢰번호',timestamp:'응답시간',projectType:'프로젝트유형',pages:'예상분량',scope:'작업범위',budget:'예산',name:'이름',company:'회사명',email:'이메일',phone:'전화번호',link:'자료링크',status:'상태',note:'관리자메모'};
const ALLOWED_STATUS=['신규','검토중','견적발송','보류','완료'];
function doGet(){return HtmlService.createHtmlOutputFromFile('Admin').setTitle('DYNOV · 문의 관리').addMetaTag('viewport','width=device-width, initial-scale=1');}
function getSheet_(){
 const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
 if(!id)throw Error('SPREADSHEET_ID를 설정하세요.');
 const sheet=SpreadsheetApp.openById(id).getSheetByName(SHEET_NAME);
 if(!sheet)throw Error('시트를 찾지 못했습니다: '+SHEET_NAME);
 return sheet;
}
function getHeaders_(sheet){return sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(v=>String(v).trim());}
function findRow_(sheet,headers,id){
 const col=headers.indexOf(HEADERS.id)+1;
 if(!col)throw Error('의뢰번호 열이 없습니다.');
 const n=sheet.getLastRow();
 if(n<2)throw Error('문의가 없습니다.');
 const ids=sheet.getRange(2,col,n-1,1).getDisplayValues().map(r=>r[0].trim());
 const matches=ids.flatMap((v,i)=>v===String(id).trim()?[i+2]:[]);
 if(matches.length!==1)throw Error('의뢰번호가 없거나 중복되었습니다.');
 return matches[0];
}
function listInquiries(){
 const sheet=getSheet_(),data=sheet.getDataRange().getDisplayValues();
 if(data.length<2)return [];
 const headers=data[0].map(s=>s.trim());
 for(const key of ['id','timestamp','scope','name','status'])if(!headers.includes(HEADERS[key]))throw Error('필수 열 없음: '+HEADERS[key]);
 return data.slice(1).filter(row=>row.some(v=>v!=='')).map(row=>{
  const r={};for(const [key,label] of Object.entries(HEADERS)){const i=headers.indexOf(label);r[key]=i<0?'':row[i];}
  return r;
 }).filter(r=>r.id);
}
function checkConnection(){
 const sheet=getSheet_();const headers=getHeaders_(sheet);
 const required=[HEADERS.id,HEADERS.timestamp,HEADERS.scope,HEADERS.name,HEADERS.status];
 return {sheetName:sheet.getName(),rowCount:sheet.getLastRow(),columns:sheet.getLastColumn(),missingHeaders:required.filter(h=>!headers.includes(h)),readOnly:true};
}
function updateInquiry(id,status,note){
 if(!ALLOWED_STATUS.includes(status))throw Error('허용되지 않은 상태입니다.');
 if(typeof note!=='string'||note.length>2000)throw Error('메모는 2000자 이하입니다.');
 const lock=LockService.getScriptLock();lock.waitLock(10000);
 try{
  const sheet=getSheet_();let headers=getHeaders_(sheet);
  const row=findRow_(sheet,headers,id);
  const statusCol=headers.indexOf(HEADERS.status)+1;
  if(!statusCol)throw Error('상태 열이 없습니다.');
  // Only add the admin note column after a deliberate save.
  let noteCol=headers.indexOf(HEADERS.note)+1;
  if(!noteCol){noteCol=sheet.getLastColumn()+1;sheet.getRange(1,noteCol).setValue(HEADERS.note);}
  sheet.getRange(row,statusCol).setValue(status);
  sheet.getRange(row,noteCol).setValue(note);
  return {ok:true};
 }finally{lock.releaseLock();}
}
