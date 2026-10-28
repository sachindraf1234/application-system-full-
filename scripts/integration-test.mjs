import assert from 'node:assert/strict';
import { stat, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { jsPDF } from 'jspdf';
import sharp from 'sharp';
import JSZip from 'jszip';
import { execFileSync } from 'node:child_process';

// Run against a dedicated server with an isolated DATA_DIR, e.g.
// DATA_DIR="$PWD/.test-data" PORT=3001 npm run dev
const base = process.env.TEST_URL || 'http://127.0.0.1:3001';
const get = async path => {
  const res = await fetch(base + path);
  assert.equal(res.status, 200, `${path}: ${res.status}`);
  return res.json();
};

const applicants = await get('/api/applicants');
assert.ok(applicants.length > 0, 'Registry should contain candidates');
const candidate = applicants[0];
await fetch(base + `/api/evisa-applications/${candidate.applicant_id}`, { method:'DELETE' }); // isolate reruns
const profile = await get(`/api/applicants/${candidate.applicant_id}`);
assert.equal(profile.profile.applicant_id, candidate.applicant_id);
await get('/api/dashboard/stats');

const input = {
  applicant_id: candidate.applicant_id,
  format: 'format2',
  data: { name: 'TEST GIVEN', surname: 'TEST SURNAME', passportNo: 'TEST123', careers: [], trainings: [], photoUrl: 'data:image/png;base64,iVBORw0KGgo=', attachments: [{ id: 'att-test', type: 'other', title: 'Test', url: 'data:image/png;base64,iVBORw0KGgo=' }] }
};
let response = await fetch(base + '/api/cv-applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, applicant_id: 'NOT_FOUND' }) });
assert.equal(response.status, 400, 'Cannot link a missing registry candidate');
response = await fetch(base + '/api/cv-applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, data: { ...input.data, name: '', surname: '' } }) });
assert.equal(response.status, 400, 'Cannot save an unnamed application');

response = await fetch(base + '/api/cv-applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
assert.equal(response.status, 201);
const created = await response.json();
assert.equal(created.applicant_id, candidate.applicant_id);
assert.ok(created.application_id.startsWith('CV-'));
const summaries = await get('/api/cv-applications');
assert.ok(summaries.find(a => a.application_id === created.application_id));
assert.ok(!('data' in summaries.find(a => a.application_id === created.application_id)), 'List should not include large attachments');
let record = await get(`/api/cv-applications/${created.application_id}`);
assert.equal(record.data.passportNo, 'TEST123');
assert.equal(record.data.attachments[0].title, 'Test');
assert.equal(record.data.photoUrl, input.data.photoUrl);

response = await fetch(base + `/api/cv-applications/${created.application_id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, data: { ...input.data, passportNo: 'TEST456' }, format: 'format3' }) });
assert.equal(response.status, 200);
record = await get(`/api/cv-applications/${created.application_id}`);
assert.equal(record.data.passportNo, 'TEST456');
assert.equal(record.format, 'format3');
response = await fetch(base + `/api/cv-applications/${created.application_id}`, { method: 'DELETE' });
assert.equal(response.status, 200);
response = await fetch(base + `/api/cv-applications/${created.application_id}`);
assert.equal(response.status, 404);
console.log('API tests passed: registry, create/list/read/update/delete CV application, validation.');

// AI unavailability must never fabricate candidate details from a filename or alter records.
response = await fetch(base + '/api/documents/extract', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ fileName:'TEST_PERSON_PASSPORT.pdf', fileData:'data:application/pdf;base64,JVBERi0xLjQK', mimeType:'application/pdf', sectionContext:'applicants', autoSave:true }) });
assert.equal(response.status, 503, 'Missing AI credentials must produce an honest error, never fake extracted identity data');
assert.equal((await get('/api/applicants')).length, applicants.length, 'Failed extraction must not create candidates');
response = await fetch(base + `/api/evisa-applications/${candidate.applicant_id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:{documents:[{fileName:'not-allowed.pdf'}]}})});
assert.equal(response.status,400,'Supporting documents must be rejected from E-Visa drafts');
response = await fetch(base + '/api/evisa-applications/MISSING-CANDIDATE', {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:{fileNumber:'TEST'}})});
assert.equal(response.status,404,'E-Visa drafts require an existing registry candidate');

// Upstream e-v extractor and code-generator contracts: no fabricated fields or live agent.
response = await fetch(base + '/api/ai/extract-data', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentText:'Applicant:\nSurname: SAMPLE\nFirst Names: ALEX\nPassport Number: X0000001',images:[],selectedModel:'regex_offline'})});
assert.equal(response.status,200);
let extracted = await response.json();
assert.equal(extracted.extractedData.PersonalData.surname,'SAMPLE');
assert.equal(extracted.extractedData.TravelDocument.passport_number,'X0000001');
assert.ok(!extracted.extractedData.PersonalData.dob_year,'Never infer missing dates');
response=await fetch(base+'/api/ai/extract-data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentText:'Applicant:\nSurname: SAMPLE\nDate of Birth: 10/03/1997\nHome Address: TEST STREET\nSpouse:\nSurname: DIFFERENT\nFirst Names: TAYLOR\nCompany:\nCompany Name: EXAMPLE LTD\nOther:\nArrival Date: 2026-12-03',images:[],selectedModel:'regex_offline'})});
assert.equal(response.status,200);
extracted=await response.json();
assert.equal(extracted.extractedData.PersonalData.surname,'SAMPLE');
assert.equal(extracted.extractedData.SpouseData.spouse_surname,'DIFFERENT');
assert.equal(extracted.extractedData.CompanyContactData.name,'EXAMPLE LTD');
assert.equal(extracted.extractedData.AddressData.address,'TEST STREET');
assert.deepEqual([extracted.extractedData.PersonalData.dob_day,extracted.extractedData.PersonalData.dob_month,extracted.extractedData.PersonalData.dob_year],['10','03','1997']);
assert.ok(!extracted.extractedData.TravelDocument,'No passport invented from other sections');
response=await fetch(base+'/api/ai/extract-data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentText:'Applicant:\nSurname: SAMPLE',images:[],selectedModel:'auto'})});
assert.equal(response.status,503,'Unavailable private Gemini is not misrepresented as AI extraction');
response=await fetch(base+'/api/ai/audit-verification',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({extractedData:{PersonalData:{surname:'SAMPLE'}},documentText:'Surname: SAMPLE',images:[],selectedModel:'auto'})});
assert.equal(response.status,503,'No API key must not yield a fabricated AI audit');
const genericWorkflows=await get('/api/workflow-scripts');
assert.ok(genericWorkflows.videoForm.includes('fill_dropdowns')&&!genericWorkflows.playwright.includes('PERERA'));
response=await fetch(base+'/api/generate-python-script',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({applicant:{personalData:{surname:'SAMPLE'},travelDoc:{passport_number:'X0000001'}},config:{}})});
assert.equal(response.status,200);
const generated=await response.json();
assert.ok(generated.script.includes('from selenium import webdriver')&&generated.script.includes('SAMPLE'));
assert.ok(!generated.script.includes('set_input_files')&&!generated.script.includes('9222'));
assert.ok(generated.stageCount >= 16 && generated.fieldCount === 2);
response=await fetch(base+'/api/generate-python-script',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({applicant:{selection:{diplomatic_mission:'TEST POST'}},config:{targetMode:'DIPLOMATIC_MISSION'}})});
assert.equal(response.status,200);
const missionScript=await response.json();
assert.ok(missionScript.script.includes('TEST POST')&&missionScript.script.includes('DIPLOMATIC_MISSION'));
assert.ok(missionScript.playwrightTxt.includes('Diplomatic Mission'));
assert.ok(missionScript.playwrightFull.includes('FULL_PIPELINE'),'Full workflow tab must include all allowed stages even when a narrower stage is selected');
response=await fetch(base+'/api/evisa-script-downloads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({applicant:{fileNumber:'E-SYNTH-001',personalData:{surname:'SAMPLE'},travelDoc:{passport_number:'X0000001'}},config:{targetMode:'FULL_PIPELINE',targetApplicationUrl:'https://eviza.mae.ro/home?lang=en'},localFolder:'C:\\SYNTHETIC_TEST\\DOCS'})});
assert.equal(response.status,200);
const direct=await response.json();
for(const key of ['selenium','playwright','playwright_full','playwright_js','video_form','zip','local_py','local_bat','local_zip','original_py','original_bat','original_cdp','original_zip']) {
  assert.ok(direct.files[key].href.startsWith('/api/evisa-script-downloads/'));
  const download=await fetch(base+direct.files[key].href);
  assert.equal(download.status,200,key);
  assert.match(download.headers.get('content-disposition')||'',/attachment; filename=/);
  assert.equal(download.headers.get('cache-control'),'private, no-store');
  if(key==='zip') {
    const zip=await JSZip.loadAsync(Buffer.from(await download.arrayBuffer()));
    assert.ok(zip.file('playwright_visa_workflow.py') && zip.file('evisa_selenium_reference.py'));
    assert.ok(!zip.file(/\.bat$|supporting/i).length,'Reference ZIP must exclude launcher/supporting-document automation');
  } else if(key==='local_zip') {
    const zip=await JSZip.loadAsync(Buffer.from(await download.arrayBuffer()));
    assert.equal(Object.keys(zip.files).length,4,'Local package contains only Python, BAT, requirements and README');
    assert.equal(zip.file(/\.py$/).length,1);
    assert.equal(zip.file(/\.bat$/).length,1);
    assert.equal(zip.file(/\.(pdf|png|jpg)$/i).length,0,'Personal documents must stay in the local folder');
    const py=await zip.file(/\.py$/)[0].async('string');
    assert.equal(py,direct.localScript);
    assert.ok(py.includes('SYNTHETIC_TEST') && py.includes('https://eviza.mae.ro/home?lang=en'));
    assert.ok(!py.includes('connect_over_cdp') && !py.includes('9222'));
    const bat=await zip.file(/\.bat$/)[0].async('string');
    assert.ok(bat.includes('INSTALL') && bat.includes('--run') && !bat.includes('remote-debugging-port'));
    const requirements=await zip.file('requirements.txt').async('string');
    assert.ok(requirements.includes('playwright'));
  } else if(key==='original_zip') {
    const zip=await JSZip.loadAsync(Buffer.from(await download.arrayBuffer()));
    assert.equal(Object.keys(zip.files).length,5);
    assert.equal(zip.file(/\.py$/).length,1);
    assert.equal(zip.file(/\.bat$/).length,2);
    assert.equal(zip.file(/\.(pdf|png|jpg)$/i).length,0);
    const original=await zip.file(/\.py$/)[0].async('string');
    assert.ok(original.includes('async def trigger_save_and_next(self)') && original.includes('async def page_summary(self)'));
    assert.ok(!original.includes('_check_applicant_preflight') && !original.includes('_portal_page_allowed'),'Do not add guards to the user-supplied automation functions');
    const originalFunctionHashes=`import sys,ast,hashlib\ns=sys.stdin.read();t=ast.parse(s)\nfor name in ['trigger_save_and_next','trigger_next_only','page_supporting_documents','page_summary','run_visa_automation']:\n n=next(n for n in ast.walk(t) if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and n.name==name)\n print(name,hashlib.sha256(ast.get_source_segment(s,n).encode()).hexdigest())\n`;
    const actualHashes=execFileSync('python3',['-c',originalFunctionHashes],{input:original,encoding:'utf8'});
    for(const digest of ['0eacede8cdb508b6025c4003d9f7e16163ce0386ae9e069f42bfecb10ec1d826','417b192802378ab17dcfcebc3003cdf4f84db75a77b164444de353c9d5637983','d30f6f2723fa8c6d90edeed687b30a33a3fef9c1776d769cccd9e0d6ef5822be','8d9e33cbc00c4a605c11a1b6313dc60b16359151483328e61db06582deeb3e1c','7d9f35dd49bebc2351460b051b1f0042f366911a9930de4822ff5abfdfd799ff']) assert.ok(actualHashes.includes(digest),'Generated original-flow function must match supplied attachment exactly');
    assert.ok(original.includes('SYNTHETIC_TEST') && original.includes('https://eviza.mae.ro/home?lang=en'));
    assert.equal((original.match(/E\d{14}/g)||[]).length,0,'Original template must never leak a different applicant number');
    execFileSync('python3',['-c','import sys; compile(sys.stdin.read(),"original.py","exec")'],{input:original});
    assert.ok((await zip.file('requirements.txt').async('string')).includes('pypdf'));
  } else if(key==='original_py') {
    const original=await download.text();
    assert.ok(original.length>500000 && original.includes('async def trigger_save_and_next(self)'));
  } else if(key==='original_bat' || key==='original_cdp') assert.ok((await download.text()).includes('E-SYNTH-001'));
  else if(key==='local_py') assert.equal(await download.text(),direct.localScript);
  else if(key==='local_bat') assert.ok((await download.text()).includes('--run'));
  else assert.equal(await download.text(),direct[key==='selenium'?'script':key==='playwright_full'?'playwrightFull':key==='playwright_js'?'playwrightJs':key==='video_form'?'videoForm':'playwright']);
}
const generatedDir=await mkdtemp(join(tmpdir(),'evisa-download-check-'));
try {
  const localPath=join(generatedDir,'local.py');
  await writeFile(localPath,direct.localScript);
  const localDryRun=execFileSync('python3',[localPath],{encoding:'utf8'});
  assert.ok(localDryRun.includes('No browser launched') && localDryRun.includes('16 stages'));
  const localCheck=`import sys,asyncio\nns={'__name__':'safe_import'}\nexec(sys.stdin.read(),ns)\nassert ns['DEFAULT_FOLDER']==r'C:\\SYNTHETIC_TEST\\DOCS'\ntry: ns['validate_url']('https://eviza.mae.ro.attacker.invalid/')\nexcept ValueError: pass\nelse: raise AssertionError('unsafe URL accepted')\nvalues=[]\nclass Locator:\n @property\n def first(self): return self\n async def count(self): return 1\n async def is_visible(self): return True\n async def evaluate(self,expression): return 'input'\n async def fill(self,value,timeout=None): values.append(value)\n async def click(self,timeout=None): values.append('SAVE_CLICKED')\nclass Page:\n def locator(self,expression): return Locator()\nasync def check():\n for stage in ns['selected_stages'](): await ns['fill_stage'](Page(),stage)\nasyncio.run(check())\nassert 'SAMPLE' in values and 'X0000001' in values,values\nimport builtins\nbuiltins.input=lambda prompt:'NO'\nassert asyncio.run(ns['confirmed_click'](Page(),'//button','SAVE')) is False\nassert 'SAVE_CLICKED' not in values\nbuiltins.input=lambda prompt:'SAVE'\nassert asyncio.run(ns['confirmed_click'](Page(),'//button','SAVE')) is True\nassert values.count('SAVE_CLICKED')==1\n`;
  execFileSync('python3',['-c',localCheck],{input:direct.localScript});
  for(const [name,script] of [['selenium.py',generated.script],['playwright.py',generated.playwright],['playwright_full.py',generated.playwrightFull],['dropdown.py',generated.videoForm],['playwright.cjs',generated.playwrightJs]]) {
    const path=join(generatedDir,name);
    await writeFile(path,script);
    const command=name.endsWith('.py')?'python3':'node';
    if(name.endsWith('.py')) execFileSync(command,['-c',`import sys; compile(sys.stdin.read(), "${name}", "exec")`],{input:script});
    else execFileSync(command,['--check',path]);
    const output=execFileSync(command,[path],{encoding:'utf8'});
    assert.ok(output.includes('No browser launched') || output.includes('Import fill_dropdowns'),`${name} must run safely without launching a browser`);
  }
  const nodeMock=`const {PLAN,fillVisibleFields}=require(process.argv[1]); const values=[]; const page={locator:()=>({first:()=>({count:async()=>1,isVisible:async()=>true,evaluate:async()=> 'input',fill:async v=>values.push(v)})})}; fillVisibleFields(page).then(()=>{if(PLAN.stages.length!==16 || !values.includes('SAMPLE') || !values.includes('X0000001')) process.exitCode=1;});`;
  execFileSync('node',['-e',nodeMock,join(generatedDir,'playwright.cjs')],{encoding:'utf8'});
  const pyMock=`import asyncio,sys\nns={'__name__':'downloaded_reference'}\nexec(sys.stdin.read(),ns)\nvalues=[]\nclass Locator:\n @property\n def first(self): return self\n async def count(self): return 1\n async def is_visible(self): return True\n async def evaluate(self,expr): return 'input'\n async def fill(self,value,timeout=None): values.append(value)\nclass Page:\n def locator(self,sel): return Locator()\nasyncio.run(ns['fill_visible_fields'](Page()))\nassert 'SAMPLE' in values and 'X0000001' in values, values\n`;
  execFileSync('python3',['-c',pyMock],{input:generated.playwright});
} finally {await rm(generatedDir,{recursive:true,force:true});}
assert.ok(generated.playwrightTxt.includes('Biometric Photo')&&generated.playwrightTxt.includes('Manual Summary Review'));
console.log('E-Visa AI/offline extraction, safe standalone Selenium/Playwright dry-runs and mock text-fill contracts passed.');

// Local OCR is self-hosted and must extract text even when Gemini is absent.
for (const [fixture, langs, expected] of [
  ['english-fields.png', ['eng'], 'passportNo'],
  ['sinhala-fields.png', ['sin','eng'], 'name']
]) {
  const image = (await readFile(new URL(`../tests/fixtures/${fixture}`, import.meta.url))).toString('base64');
  const result = await fetch(base + '/api/ocr/local', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ images:[`data:image/png;base64,${image}`], languages: langs }) });
  if (!result.ok) throw new Error(`Local OCR ${fixture} failed: ${await result.text()}`);
  const parsed = await result.json();
  assert.ok(parsed.suggestions.some(item => item.field === expected), `${fixture} should suggest ${expected}`);
  if (fixture === 'sinhala-fields.png') {
    const passportHint=parsed.suggestions.find(item=>item.field==='passportNo');
    assert.ok(passportHint.confidence < 0.5, 'Unreadable passport prefix must be flagged as uncertain, not trusted');
  }
}
response = await fetch(base + `/api/applicants/${candidate.applicant_id}/ocr-fields`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ fields: { phone: '0000000000' } }) });
assert.equal(response.status, 200);
assert.equal((await get(`/api/applicants/${candidate.applicant_id}`)).profile.mobile_number, '0000000000');
response = await fetch(base + `/api/applicants/${candidate.applicant_id}/ocr-fields`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({fields:{company_name:'TEST COMPANY',se_number:'SETEST123',e_number:'ETEST123',appointment_date:'12/10/2026',police_certified_date:'11/10/2026'}}) });
assert.equal(response.status, 200);
const reviewedSections = await get(`/api/applicants/${candidate.applicant_id}`);
assert.equal(reviewedSections.embassy.company_name, 'TEST COMPANY');
assert.equal(reviewedSections.embassy.appointment_date, '2026-10-12');
assert.equal(reviewedSections.checklist.police_certified_date, '2026-10-11');
console.log('Local English/Sinhala OCR and reviewed registry update passed.');

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const errors = [];
  const consoleErrors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('dialog', dialog => dialog.accept());
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Master Registry/ }).click();
  await page.getByRole('button', { name: /Application Creation/ }).click();
  await page.locator('.cv-workspace').waitFor({ timeout: 30000 });
  await page.getByRole('textbox', { name: 'Search candidate name', exact: true }).fill(candidate.full_name.slice(0, 18));
  await page.getByRole('button', { name: new RegExp(candidate.full_name.slice(0,18)) }).last().click();
  await page.waitForFunction(name => document.querySelector('.cv-workspace')?.textContent?.includes(name), candidate.other_name || candidate.full_name);
  await page.getByTitle('Save current application to the shared system database').click();
  await page.waitForFunction(async id => (await (await fetch('/api/cv-applications')).json()).some(item => item.applicant_id === id), candidate.applicant_id);
  const savedId = (await get('/api/cv-applications')).find(item => item.applicant_id === candidate.applicant_id)?.application_id;
  assert.ok(savedId);
  const saved = await get(`/api/cv-applications/${savedId}`);
  assert.equal(saved.applicant_id, candidate.applicant_id);
  assert.equal(saved.data.passportNo, profile.passport?.passport_number || '');
  await page.getByRole('button', { name: /Application created applicants/ }).click();
  await page.getByRole('heading', { name: 'Application created applicants' }).waitFor();
  const tablePdfPromise = page.waitForEvent('download', { timeout: 20000 });
  await page.getByRole('button', { name: 'Download table PDF' }).click();
  const tablePdf = await tablePdfPromise;
  assert.ok((await stat(await tablePdf.path())).size > 1000);
  await page.getByRole('button', { name: /Application creation pending applicants/ }).click();
  await page.getByRole('heading', { name: 'Application creation pending applicants' }).waitFor();
  const pendingPdfPromise = page.waitForEvent('download', { timeout: 20000 });
  await page.getByRole('button', { name: 'Download table PDF' }).click();
  assert.ok((await stat(await (await pendingPdfPromise).path())).size > 1000);
  await page.getByRole('button', { name: /Create \/ edit/ }).click();

  // Exercise all three layout switches, browser reload, draft restore and deletion.
  for (const label of ['Format 01', 'Format 02', 'Format 03']) {
    await page.getByRole('button', { name: label, exact: true }).last().click();
    await page.locator('#cv-page-1').waitFor();
    const format = `format${label.slice(-1)}`;
    const archivePromise = page.waitForEvent('download', { timeout: 60000 });
    await page.getByTitle('Download self-contained offline HTML copy of this CV with all data embedded').click();
    const archive = await archivePromise;
    const archiveText = await readFile(await archive.path(), 'utf8');
    assert.ok(archiveText.includes(`<title>${candidate.other_name} ${candidate.surname} - ${format}</title>`), `${format} archive should use its selected format`);
    assert.ok(archiveText.includes('id="cv-page-1"'));
    const formatPdfPromise = page.waitForEvent('download', { timeout: 60000 });
    await page.getByTitle('Download completed CV directly as a PDF document file').click();
    const formatPdf = await formatPdfPromise;
    assert.ok((await stat(await formatPdf.path())).size > 1000, `${format} PDF must contain rendered pages`);
  }
  await page.getByRole('button', { name: 'Format 01', exact: true }).last().click();
  const pdfDownloadPromise = page.waitForEvent('download', { timeout: 60000 });
  await page.getByTitle('Download completed CV directly as a PDF document file').click();
  const pdfDownload = await pdfDownloadPromise;
  assert.ok(pdfDownload.suggestedFilename().endsWith('.pdf'));
  assert.ok((await stat(await pdfDownload.path())).size > 1000, 'PDF should contain rendered pages');
  console.log('PDF export test passed:', pdfDownload.suggestedFilename());
  const htmlPromise = page.waitForEvent('download', { timeout: 60000 });
  await page.getByTitle('Download self-contained offline HTML copy of this CV with all data embedded').click();
  const htmlDownload = await htmlPromise;
  const html = await readFile(await htmlDownload.path(), 'utf8');
  assert.ok(html.includes(candidate.other_name || candidate.full_name));
  assert.ok(html.includes('.paper-page'), 'Offline HTML must embed layout CSS');
  assert.ok(!html.includes('cdn.tailwindcss.com'), 'Offline HTML must not rely on a CDN');
  console.log('Offline HTML export test passed.');
  const jpegPromise = page.waitForEvent('download', { timeout: 90000 });
  await page.getByTitle('Download completed CV pages packaged together in a single ZIP archive').click();
  const jpegDownload = await jpegPromise;
  assert.ok(jpegDownload.suggestedFilename().endsWith('.zip'));
  assert.ok((await stat(await jpegDownload.path())).size > 1000);
  console.log('JPEG ZIP export test passed.');
  const samplePdf = new jsPDF();
  samplePdf.text('TEST PASSPORT DOCUMENT', 20, 20);
  await page.locator('.cv-workspace aside input[type="file"][accept="application/pdf,image/*"]').first().setInputFiles({
    name: 'test_document.pdf', mimeType: 'application/pdf', buffer: Buffer.from(samplePdf.output('arraybuffer'))
  });
  await page.getByText('STAGED DOCUMENTS (1)').waitFor();
  await page.getByRole('button', { name: /Extract & Auto-Fill/ }).click();
  await page.getByText('Extraction Failed').waitFor({ timeout: 30000 });
  assert.ok(await page.locator('.cv-workspace').getByText(/GEMINI_API_KEY/).count(), 'Without an API key, OCR must report why it cannot run');
  assert.ok(!consoleErrors.some(error => error.includes('Failed to parse PDF')), `Bundled PDF worker failed: ${consoleErrors.join('; ')}`);
  await page.locator('[data-testid="local-ocr-panel"]').getByText(/Recognition confidence:/).waitFor({ timeout:45000 });
  console.log('PDF upload, missing-key error and automatic local OCR fallback passed.');
  const englishPng = await readFile(new URL('../tests/fixtures/english-fields.png', import.meta.url));
  await page.getByLabel('OCR document files').setInputFiles({ name:'english-fields.png', mimeType:'image/png', buffer:englishPng });
  await page.getByLabel('OCR languages').selectOption('eng');
  await page.getByRole('button', { name: 'Extract with local OCR' }).click();
  await page.getByLabel('OCR passportNo').waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: 'Apply reviewed fields' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('#cv-page-1 input')].some(input => input.value === 'N1234567'));
  console.log('Local OCR browser review and CV field application passed.');
  const signatureImage = await sharp(Buffer.from('<svg width="300" height="95" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="95" fill="white"/><path d="M15 65 Q35 16 52 65 Q80 5 85 68 Q100 36 119 62 Q148 19 175 65 Q205 10 260 65" fill="none" stroke="#153868" stroke-width="4"/></svg>')).png().toBuffer();
  let aiSignatureCalls = 0;
  await page.route('**/api/extract-signature', async route => { aiSignatureCalls++; await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:false,found:false})}); });
  await page.locator('[data-testid="signature-ingestion"] input[type="file"]').setInputFiles({name:'isolated-signature.png',mimeType:'image/png',buffer:signatureImage});
  await page.getByText('Signature Extracted!').waitFor({timeout:30000});
  assert.equal(aiSignatureCalls,1,'AI signature location must be attempted before local isolated-image cleaning');
  await page.unroute('**/api/extract-signature');
  console.log('Signature AI-first attempt and local isolated-image fallback passed.');
  await page.getByRole('button', { name: /Batch Processing/ }).click();
  await page.getByText('Batch CV Processing Center').waitFor();
  const batchSlot=page.locator('[data-testid="batch-slot-1"]');
  await batchSlot.locator('input[type="file"]').first().setInputFiles({name:'old-nic.png',mimeType:'image/png',buffer:await readFile(new URL('../tests/fixtures/sinhala-fields.png',import.meta.url))});
  await batchSlot.getByRole('button',{name:'Process Slot'}).click();
  await batchSlot.getByText(/AI → local OCR → manual review/).waitFor({timeout:90000});
  assert.equal(await batchSlot.getByRole('button',{name:'Download Folder ZIP'}).count(),0,'Unreviewed OCR must not be exportable');
  assert.ok(await batchSlot.getByLabel('Folder 1 name').count(),'Sinhala local fallback should surface editable name');
  await batchSlot.getByRole('button',{name:'Apply reviewed fields'}).click();
  await batchSlot.getByLabel('Folder 1 given names').fill('REVIEWED GIVEN');
  await batchSlot.getByLabel('Folder 1 surname').fill('REVIEWED SURNAME');
  await batchSlot.getByRole('button',{name:'Confirm reviewed batch CV'}).click();
  await batchSlot.getByRole('button',{name:'Download Folder ZIP'}).waitFor();
  console.log('Batch AI failure, Sinhala local OCR, manual correction and export guard passed.');
  const batchSlot2=page.locator('[data-testid="batch-slot-2"]');
  let localAfterAiSuccess=0;
  await page.route('**/api/ocr/local', async route => {localAfterAiSuccess++; await route.continue();});
  await page.route('**/api/ocr', async route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:{name:'AI GIVEN',surname:'AI SURNAME',passportNo:'A1234567'}})}));
  await batchSlot2.locator('input[type="file"]').first().setInputFiles({name:'passport.png',mimeType:'image/png',buffer:englishPng});
  await batchSlot2.getByRole('button',{name:'Process Slot'}).click();
  await batchSlot2.getByRole('button',{name:'Download Folder ZIP'}).waitFor({timeout:45000});
  assert.equal(localAfterAiSuccess,0,'Successful AI extraction must not invoke local OCR');
  await page.unroute('**/api/ocr/local');
  await page.unroute('**/api/ocr');
  console.log('Batch AI priority without unnecessary local OCR passed.');
  await page.getByRole('button', { name: /Single Processing/ }).click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Application Creation/ }).click();
  await page.getByRole('textbox', { name: 'Search application' }).fill(savedId);
  await page.getByRole('button', { name: new RegExp(candidate.other_name.slice(0,16)) }).last().click();
  await page.getByRole('button', { name: 'Delete saved' }).waitFor();
  await page.getByRole('button', { name: 'Delete saved' }).click();
  await page.getByRole('button', { name: 'Delete saved' }).waitFor({state:'hidden'});
  assert.equal((await fetch(base + `/api/cv-applications/${savedId}`)).status, 404);
  await page.getByRole('button', { name: '← Back' }).click();
  const sectionNames = [
    'Follow-Up / Initial Contact', 'Executive Dashboard', 'Master Registry', 'E-Visa Application',
    'Embassy Pending', 'English Testing', 'Embassy documents checklist',
    'Embassy Interviews', 'Departure Pending', 'Departures & Flights',
    'All Master Records', 'Reports & Analytics', 'Calendar & Timeline Engine',
    'Staff Management', 'Activity Audit Log', 'System Configuration', 'AI Copilot Workspace'
  ];
  for (const section of sectionNames) {
    await page.locator('aside.no-print').getByRole('button', { name: section, exact: false }).first().click();
    await page.waitForTimeout(100);
    assert.ok(await page.locator('main').first().isVisible(), `${section} should render`);
    if (section === 'Master Registry') {
      await page.getByRole('button', { name:'AI Document Upload & Auto-Fill' }).click();
      await page.locator('input[type="file"][accept*="application/pdf"]').last().setInputFiles({name:'english-fields.png',mimeType:'image/png',buffer:englishPng});
      await page.getByRole('button', { name:'Run AI extraction (review required)' }).click();
      await page.getByLabel('OCR passportNo').waitFor({timeout:30000});
      await page.getByRole('button', { name:'Apply reviewed fields', exact:true }).click();
      await page.getByLabel('Select exact OCR candidate').selectOption(candidate.applicant_id);
      await page.getByRole('button', { name:'Apply reviewed OCR fields' }).click();
      await page.getByLabel('Select exact OCR candidate').waitFor({state:'hidden'});
      const updatedProfile = await get(`/api/applicants/${candidate.applicant_id}`);
      assert.equal(updatedProfile.passport?.passport_number, 'N1234567');
      console.log('Shared upload modal AI failure, automatic local OCR and explicit candidate review passed.');
    }
    if (section === 'E-Visa Application') {
      // Regression: opening E-Visa must show the upstream studio even before selecting a candidate.
      await page.getByText('Master Schematics Data Editor').waitFor();
      await page.getByText('The complete E-Visa studio is open below').waitFor();
      assert.equal(await page.getByRole('button',{name:'Save E-Visa Draft'}).isDisabled(),true);
      await page.setViewportSize({width:900,height:900});
      for(const sectionLabel of ['AI Extractor','Python Selenium Code','DOM / XPath Inspector']) {
        const bounds=await page.getByRole('navigation',{name:'E-Visa studio sections'}).getByRole('button',{name:sectionLabel}).boundingBox();
        assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 900,`${sectionLabel} must remain visible at the supplied screenshot width, without horizontal tab scrolling`);
      }
      for(const subLabel of ['Personal Bio','Passport & Job','Visa Category & Mission']) {
        const bounds=await page.getByRole('button',{name:subLabel,exact:true}).boundingBox();
        assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 900,`${subLabel} must remain visible without horizontal scrolling`);
      }
      await page.setViewportSize({width:1440,height:900});
      await page.getByRole('button',{name:'AI Extractor'}).click();
      await page.getByText('AI Document Schematics & Extraction Hub').waitFor();
      assert.equal(await page.getByPlaceholder('e.g. WP-2026-991823').first().inputValue(),'');
      await page.getByRole('button',{name:'Python Selenium Code'}).click();
      await page.waitForFunction(()=>document.querySelector('[data-testid="evisa-generated-code"]')?.textContent?.includes('from selenium import webdriver'));
      await page.getByRole('button',{name:'DOM / XPath Inspector'}).click();
      await page.getByText('XPath Selectors & Session Guards Inspector').waitFor();
      const emptyStudio=page.locator('[data-testid="evisa-workspace"]');
      assert.equal(await emptyStudio.getByRole('button',{name:'Save E-Visa Draft'}).isDisabled(),true);
      assert.equal(await emptyStudio.getByText(/E-VISA Application Stages \(/).count(),0);
      assert.equal(await emptyStudio.getByRole('button',{name:'Biometric Photo',exact:true}).count(),0);
      assert.equal(await emptyStudio.getByRole('button',{name:'Summary',exact:true}).count(),0);
      assert.equal(await emptyStudio.getByText('Biometric Photo Preparation').count(),0);
      assert.equal(await emptyStudio.getByText('Draft Summary & Manual Review').count(),0);
      await page.getByRole('button',{name:'Master Schematics Data'}).click();
      console.log('E-Visa studio remains visible without candidate; requested stages/photo/summary panels absent, saving gated.');
      await page.getByLabel('Search E-Visa candidate').fill(candidate.registration_number);
      await page.locator('[data-testid="evisa-workspace"]').getByRole('button', {name:new RegExp(candidate.registration_number)}).click();
      await page.getByText(/Prefilled only known registry/).waitFor();
      for (const tabName of ['Home Address','Host Details','Company Contact','Visa Requested','Cost & Means','Family & Spouse','Journey Details','Personal Bio','Passport & Job','Visa Category & Mission']) {
        await page.getByRole('button', {name:tabName,exact:true}).click();
        assert.ok(await page.locator('[data-testid="evisa-workspace"] input').count(), `${tabName} should contain editable fields`);
      }
      await page.getByRole('button', {name:'Personal Bio',exact:true}).click();
      await page.getByText('First Name(s)',{exact:true}).locator('..').locator('input').fill('');
      await page.getByRole('button', {name:'Home Address',exact:true}).click();
      await page.locator('[data-testid="evisa-workspace"] textarea').first().fill('TEST ADDRESS FOR E-VISA DRAFT');
      await page.getByRole('button', {name:'Document OCR'}).click();
      const sinhalaPng = await readFile(new URL('../tests/fixtures/sinhala-fields.png',import.meta.url));
      await page.getByLabel('OCR document files').setInputFiles({name:'sinhala-fields.png',mimeType:'image/png',buffer:sinhalaPng});
      await page.getByLabel('OCR languages').selectOption('sin+eng');
      await page.getByRole('button', {name:'Extract with local OCR'}).click();
      await page.getByLabel('OCR name').waitFor({timeout:45000});
      await page.getByRole('button', {name:'Apply reviewed fields'}).click();
      await page.getByRole('button', {name:'Save E-Visa Draft'}).click();
      await page.getByText(/E-Visa draft saved to the app database/).waitFor();
      const evisa = await get(`/api/evisa-applications/${candidate.applicant_id}`);
      assert.ok(/[\u0D80-\u0DFF]/.test(evisa.data.personalData.first_names), 'Reviewed Sinhala OCR name must reach the previously blank E-Visa field');
      assert.equal(evisa.data.addressData.address,'TEST ADDRESS FOR E-VISA DRAFT');
      assert.ok(!('documents' in evisa.data), 'Supporting documents must not be saved');
      await page.reload({waitUntil:'domcontentloaded'});
      await page.locator('aside.no-print').getByRole('button', {name:'E-Visa Application'}).click();
      await page.getByLabel('Search E-Visa candidate').fill(candidate.registration_number);
      await page.locator('[data-testid="evisa-workspace"]').getByRole('button', {name:new RegExp(candidate.registration_number)}).click();
      await page.getByText(/Opened saved E-Visa draft/).waitFor();
      await page.getByRole('button', {name:'AI Extractor'}).click();
      await page.getByText('AI Document Schematics & Extraction Hub').waitFor();
      const suite=page.getByRole('region',{name:'Local Python & Playwright Visa Automation Suite'});
      await page.getByRole('button',{name:'↓ Local Python & Playwright Suite'}).click();
      assert.ok(await suite.isVisible(),'Top AI Extractor shortcut must reveal the restored bottom suite');
      await suite.getByLabel('Local Documents Folder Path').fill('C:\\SYNTHETIC_TEST\\DOCS');
      await suite.getByLabel('Applicant E-Visa Link').fill('https://eviza.mae.ro/home');
      await suite.getByRole('link',{name:'Download Original Automation (.zip)'}).waitFor({timeout:15000});
      const originalDownload=page.waitForEvent('download');
      await suite.getByRole('link',{name:'Download Original Automation (.zip)'}).click();
      const originalArchive=await JSZip.loadAsync(await readFile(await (await originalDownload).path()));
      assert.equal(originalArchive.file(/\.py$/).length,1);
      assert.equal(originalArchive.file(/\.bat$/).length,2);
      assert.equal(originalArchive.file(/\.(pdf|jpg|png)$/i).length,0);
      await suite.getByRole('link',{name:'Standalone Local .py'}).waitFor({timeout:15000});
      const suiteDownload=page.waitForEvent('download');
      await suite.getByRole('link',{name:'Standalone Local .py'}).click();
      const suiteFile=await suiteDownload;
      assert.match(suiteFile.suggestedFilename(),/^evisa_local_workflow_.*\.py$/);
      const suiteCode=await readFile(await suiteFile.path(),'utf8');
      assert.ok(suiteCode.includes('SYNTHETIC_TEST') && suiteCode.includes('https://eviza.mae.ro/home') && suiteCode.includes('confirm') && !suiteCode.includes('connect_over_cdp'));
      execFileSync('python3',['-c','import sys; compile(sys.stdin.read(),"local.py","exec")'],{input:suiteCode});
      const suiteZipPromise=page.waitForEvent('download');
      await suite.getByRole('link',{name:'Download Local Package (.zip)'}).click();
      const suiteZip=await suiteZipPromise;
      const packed=await JSZip.loadAsync(await readFile(await suiteZip.path()));
      assert.ok(packed.file(/\.bat$/).length===1 && packed.file(/\.py$/).length===1);
      assert.equal(packed.file(/\.(pdf|jpg|png)$/i).length,0,'Applicant documents must not be bundled');
      await suite.getByRole('button',{name:'Preview Conservative Script'}).click();
      await page.getByRole('dialog',{name:'Standalone local Python script preview'}).getByText(/evisa_local_workflow_/).waitFor();
      await page.getByRole('button',{name:'Close script preview'}).click();
      const extractor=page.locator('[data-testid="evisa-workspace"]');
      assert.equal(await extractor.getByPlaceholder('e.g. WP-2026-991823').first().inputValue(), '', 'An unknown work permit must remain blank, not display upstream sample identity data');
      await extractor.getByRole('button',{name:/Load example text/}).click();
      await extractor.locator('select').filter({has:page.locator('option[value=regex_offline]')}).selectOption('regex_offline');
      await extractor.getByRole('button',{name:/Run Simultaneous Extraction/}).click();
      await extractor.getByLabel('I reviewed extracted fields').waitFor();
      assert.equal(await extractor.getByRole('button',{name:'Apply reviewed suggestions to draft'}).isDisabled(),true);
      await extractor.getByLabel('I reviewed extracted fields').check();
      await extractor.getByRole('button',{name:'Apply reviewed suggestions to draft'}).click();
      const warningConfirm=extractor.getByRole('button',{name:'Confirm reviewed fields'});
      if(await warningConfirm.isVisible()) await warningConfirm.click();
      await page.getByRole('button',{name:'Save E-Visa Draft'}).click();
      await page.getByText(/E-Visa draft saved to the app database/).waitFor();
      const savedDraft=(await get(`/api/evisa-applications/${candidate.applicant_id}`)).data;
      assert.ok(!savedDraft.photoDataUrl,'Removed photo preparation must not invent a photo');
      assert.ok(savedDraft.aiExtractedData?.PersonalData?.surname,'Structured suggestions should survive draft saving');
      assert.ok(!('documents' in savedDraft));
      await page.getByRole('button', {name:'Python Selenium Code'}).click();
      for(const [tab,filename,marker] of [
        [null,/^evisa_selenium_reference\.py$/,'from selenium import webdriver'],
        ['Playwright Python (playwright_visa_workflow.py)',/^playwright_visa_workflow\.py$/,'async def fill_visible_fields'],
        ['Playwright Node.js (playwright_visa_workflow.cjs)',/^playwright_visa_workflow\.cjs$/,'module.exports'],
        ['Reusable Module (video_form_workflow.py)',/^video_form_workflow\.py$/,'fill_dropdowns'],
        ['Full Pipeline Playwright Script',/^evisa_full_playwright_.*\.py$/,'FULL_PIPELINE'],
        ['📄 Personal Data Text Steps (.txt)',/^personal_data_applicant_workflow\.txt$/,'Personal Data'],
        ['📄 Pipeline Text Steps (.txt)',/^playwright_visa_workflow\.txt$/,'Manual Summary Review'],
        ['📄 Automation Specs (.txt)',/^automation_steps\.txt$/,'Final step: inspect']
      ]) {
        if(tab) await page.getByRole('button',{name:tab,exact:true}).click();
        const directLink=page.getByRole('link',{name:/^Download /});
        const codePromise=page.waitForEvent('download');
        await directLink.click({timeout:15000});
        const downloaded=await codePromise;
        assert.match(downloaded.suggestedFilename(),filename);
        const code=await readFile(await downloaded.path(),'utf8');
        assert.ok(code.length>100 && code.includes(marker),`${downloaded.suggestedFilename()} must contain its full generated content`);
        assert.equal(code,await page.getByTestId('evisa-generated-code').textContent(),'The download must match the visible script, not a placeholder');
        if(code.endsWith('.py') || downloaded.suggestedFilename().endsWith('.py')) execFileSync('python3',['-c','import sys; compile(sys.stdin.read(),"downloaded.py","exec")'],{input:code});
        if(downloaded.suggestedFilename().endsWith('.cjs')) execFileSync('node',['--check'],{input:code});
        assert.ok(!code.includes('set_input_files') && !code.includes('9222'),'Live agent and supporting-document uploads stay excluded');
      }
      console.log('All eight code/plan tabs downloaded real matching files with valid script syntax.');
      await page.getByRole('button', {name:'DOM / XPath Inspector'}).click();
      await page.getByLabel('DOM snapshot HTML').fill('<html><body><input id="place" /></body></html>');
      await page.getByRole('button',{name:'Test XPath against snapshot'}).click();
      await page.getByLabel('XPath match results').getByText(/1 match\(es\)/).first().waitFor();
      await page.getByTestId('evisa-xpath-placeField').fill('//input[@id="custom_place_field"]');
      await page.getByRole('button', {name:'Save selectors in this browser'}).click();
      await page.getByRole('button', {name:'Python Selenium'}).click();
      await page.waitForFunction(() => document.querySelector('[data-testid="evisa-generated-code"]')?.textContent?.includes('custom_place_field'));
      await page.getByRole('button', {name:'DOM / XPath Inspector'}).click();
      const words=await page.locator('[data-testid="evisa-workspace"]').innerText();
      assert.ok(!words.includes('E-VISA Application Stages (') && !words.includes('Biometric Photo Preparation') && !words.includes('Draft Summary & Manual Review'));
      assert.ok(!words.includes('Real e-Visa Browser Agent') && !words.includes('Live CDP Console & Logs'));
      assert.equal(await page.getByRole('button',{name:'Delete saved draft'}).count(),1,'Draft deletion stays available after removing Summary');
      console.log('E-Visa registry prefill, Sinhala OCR review, save, code downloads and XPath passed; three requested panels are absent.');
      await page.getByRole('button', {name:'← Back'}).click();
    }
    if (section === 'Embassy Pending') {
      await page.getByRole('button', { name:'AI Document Upload' }).click();
      await page.getByLabel('OCR document files').setInputFiles({ name:'english-fields.png', mimeType:'image/png', buffer:englishPng });
      await page.getByRole('button', { name:'Extract with local OCR' }).click();
      await page.getByLabel('OCR passportNo').waitFor({ timeout:30000 });
      await page.getByRole('button', { name:'Apply reviewed fields' }).click();
      assert.ok(await page.locator('table').last().locator('input[value="N1234567"]').count(), 'Embassy review row should contain the OCR passport');
      assert.ok(await page.locator('table').last().locator('input[value=""]').count() > 0, 'Missing OCR fields must remain blank, not fabricated');
      await page.getByRole('button', { name:/Import & Save 1 Records/ }).click();
      await page.getByRole('button', { name:'Upload Another Document' }).waitFor();
      await page.getByRole('button', { name:'Cancel' }).last().click();
      console.log('Embassy Pending local OCR review & incomplete-row guard passed.');
    }
  }
  assert.deepEqual(errors, [], `Browser JS errors: ${errors.join('; ')}`);
  console.log('Browser tests passed: navigation, registry prefill, save, formats, reload/open and delete.');
} finally {
  await browser.close();
}
