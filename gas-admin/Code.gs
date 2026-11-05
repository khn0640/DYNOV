/**
 * DYNOV Admin — deploy as a separate Google Apps Script web app.
 * Deployment access: Only myself. Execute as: Me.
 * Set Script Property SPREADSHEET_ID to the existing inquiry spreadsheet ID.
 * Google account access is enforced by the Apps Script deployment.
 */
const SHEET_NAME = 'Sheet1';
const STATUS = ['new','review','quote','hold','done'];
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Admin')
    .setTitle('DYNOV · 문의 관리')
    .addMetaTag('viewport','width=device-width, initial-scale=1');
}
function getSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID가 설정되지 않았습니다.');
  const ss = SpreadsheetApp.openById(id);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('문의 시트가 없습니다: ' + SHEET_NAME);
  return sheet;
}
function listInquiries() {
  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();
  if (!data.length) return [];
  const headers = data[0].map(String);
  return data.slice(1).map((row,i) => {
    const record = {rowNumber:i+2};
    headers.forEach((h,j) => record[h] = row[j] instanceof Date ? row[j].toISOString() : row[j]);
    return record;
  }).filter(r=>Object.keys(r).some(k=>k!=='rowNumber' && r[k]!=='' && r[k]!==null));
}
function updateInquiry(rowNumber,status,note) {
  const sheet = getSheet_();
  rowNumber = Number(rowNumber);
  if (!Number.isInteger(rowNumber) || rowNumber < 2 || rowNumber > sheet.getLastRow()) throw new Error('잘못된 행 번호');
  if (!STATUS.includes(status)) throw new Error('잘못된 상태');
  if (typeof note !== 'string' || note.length > 2000) throw new Error('메모는 2000자 이하');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
    for (const [key,val] of [['adminStatus',status],['adminNote',note],['adminUpdatedAt',new Date()]]) {
      let col = headers.indexOf(key)+1;
      if (!col) { col=sheet.getLastColumn()+1; sheet.getRange(1,col).setValue(key); headers.push(key); }
      sheet.getRange(rowNumber,col).setValue(val);
    }
    return {ok:true};
  } finally { lock.releaseLock(); }
}
