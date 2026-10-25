import { newEvisaRecord } from '../src/evisa/defaults.js';

/** Candidate-specific, review-first reference generation based on the e-v stages.
 * Never embeds the upstream sample person, supporting-document operations, CDP,
 * live-agent code, CAPTCHA handling, or a final submission action. */
const stageGroups = [
  {id:'SELECT_VISA_TYPE', title:'Visa Type & Document Category', sections:['selection'], keys:['visa_type','type_of_travel_document']},
  {id:'DIPLOMATIC_MISSION', title:'Diplomatic Mission', sections:['selection'], keys:['diplomatic_mission']},
  {id:'VISA_PURPOSE', title:'Purpose of Stay', sections:['selection'], keys:['visa_purpose']},
  {id:'PARTICULAR_SITUATIONS', title:'Particular Situations', sections:['selection'], keys:['particular_situation']},
  {id:'TERRITORIAL_JURISDICTION', title:'Nationality, Residence & Jurisdiction', sections:['selection'], keys:['current_nationality','country_of_residence','territorial_jurisdiction','is_biometric']} ,
  {id:'PERSONAL_DATA', title:'Personal Data', sections:['personalData']},
  {id:'TRAVEL_DOCUMENT_OCCUPATION', title:'Travel Document & Occupation', sections:['travelDoc']},
  {id:'APPLICANT_HOME_ADDRESS', title:'Applicant Home Address', sections:['addressData']},
  {id:'HOST_DETAILS', title:'Host Details', sections:['hostData']},
  {id:'COMPANY_CONTACT', title:'Company Contact', sections:['companyContactData']},
  {id:'DETAILS_ABOUT_VISA', title:'Visa Requested', sections:['visaRequestedDetails']},
  {id:'COST_AND_MEANS', title:'Cost & Means', sections:['costAndMeansData']},
  {id:'FAMILY_DETAILS', title:'Family & Spouse', sections:['familyData','spouseData']},
  {id:'DETAILS_REGARDING_JOURNEY', title:'Journey Details', sections:['journeyDetailsData']},
  {id:'PHOTO_UPLOAD', title:'Biometric Photo', sections:[]},
  {id:'SUMMARY_FILE', title:'Manual Summary Review', sections:[]},
] as const;

// Curated from the upstream e-v XPath/step reference. These are examples, not
// verified against the live portal: the inspector can override them locally.
const knownSelectors:Record<string,string>={
  'personalData.surname':"//input[@id='Nume' or @name='Nume']",
  'personalData.first_names':"//input[@id='Prenume' or @name='Prenume']",
  'personalData.dob_day':"//input[@id='DataNastere_Day'] | //select[@id='DataNastere_Day']",
  'personalData.dob_month':"//input[@id='DataNastere_Month'] | //select[@id='DataNastere_Month']",
  'personalData.dob_year':"//input[@id='DataNastere_Year'] | //select[@id='DataNastere_Year']",
  'personalData.place_of_birth':"//input[@id='LocNastere']",
  'personalData.phone_number':"//input[@id='Telefon']",
  'travelDoc.passport_number':"//input[@id='NumarPasaport']",
  'addressData.place':"//input[contains(@id,'place')] | //label[contains(.,'Place')]/following-sibling::input",
  'addressData.address':"//textarea[contains(@id,'address')] | //label[contains(.,'Address')]/following-sibling::textarea",
  'hostData.hotel_name':"//input[contains(@id,'hotel_name')] | //label[contains(.,'Hotel name')]/following-sibling::input",
  'hostData.host_address':"//textarea[contains(@id,'host_address')]",
  'spouseData.spouse_surname':"//label[contains(.,'Surname of spouse')]/following-sibling::input",
  'spouseData.spouse_first_names':"//label[contains(.,'First name(s) of spouse')]/following-sibling::input",
};
const inspectorKeys:Record<string,string>={
  'personalData.current_nationality':'currentNationalityPopout',
  'selection.country_of_residence':'countryOfResidencePopout',
  'selection.diplomatic_mission':'diplomaticMissionPopout',
  'selection.type_of_travel_document':'travelDocumentPopout',
  'addressData.home_country':'homeCountryDropdown',
  'addressData.place':'placeField','addressData.address':'addressField',
  'hostData.type_of_host':'typeOfHostDropdown','hostData.hotel_name':'hotelNameField',
  'hostData.host_address':'hostAddressField',
  'spouseData.spouse_surname':'spouseSurnameField',
  'spouseData.spouse_first_names':'spouseFirstNameField',
  'spouseData.spouse_surname_at_birth':'spouseBirthSurnameField',
};
const template=newEvisaRecord() as unknown as Record<string,unknown>;
const groupKeys=Object.fromEntries(stageGroups.flatMap(stage=>stage.sections).map(section=>[section,Object.keys(template[section] as object)])) as Record<string,string[]>;
function safeFields(input:unknown) {
  const source=input && typeof input==='object' && !Array.isArray(input) ? input as Record<string,any>:{};
  return Object.fromEntries(Object.entries(groupKeys).map(([section,keys])=>[
    section,Object.fromEntries(keys.map(key=>{
      const value=source[section]?.[key];
      return [key,typeof value==='string'?value.slice(0,500):typeof value==='boolean'?value:null];
    }).filter(([,value])=>value!==null && value!==''))
  ]));
}
const genericXpath=(key:string)=>{
  const field=key.split('.')[1].replace(/[^a-z0-9_]/gi,'');
  return `//input[@name='${field}'] | //textarea[@name='${field}'] | //select[@name='${field}']`;
};
const asJson=(input:unknown)=>JSON.stringify(input);
const fileName=(value:unknown)=>String(value||'draft').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,35)||'draft';

export function buildEvisaScripts(applicant:any, config:any={}, overrides:any={}) {
  const data=safeFields(applicant);
  const stages=stageGroups.map(stage=>({id:stage.id,title:stage.title,fields:stage.sections.flatMap(section=>
    Object.entries(data[section]||{}).filter(([key])=>!('keys' in stage)||(stage.keys as readonly string[]).includes(key)).map(([key,value])=>({key:`${section}.${key}`,value})))}));
  const rawOverrides=overrides && typeof overrides==='object'&&!Array.isArray(overrides)?overrides:{};
  const selectors:Record<string,string>={};
  for(const stage of stages) for(const field of stage.fields){
    const chosen=rawOverrides[inspectorKeys[field.key]];
    selectors[field.key]=typeof chosen==='string'&&chosen.length<800&&chosen.trim()?chosen.trim():knownSelectors[field.key]||genericXpath(field.key);
  }
  const target=String(config?.targetApplicationUrl||applicant?.verificationUrl||'').slice(0,500);
  const allowed=['FULL_PIPELINE',...stageGroups.map(stage=>stage.id),'DIPLOMATIC_MISSION','VISA_PURPOSE','PARTICULAR_SITUATIONS','TERRITORIAL_JURISDICTION'];
  const targetMode=allowed.includes(config?.targetMode)?config.targetMode:'FULL_PIPELINE';
  const timeout=Math.max(1,Math.min(30,Math.floor(Number(config?.elementWaitTimeoutSec)||5)));
  const payload={target,mode:targetMode,stages,selectors,photoPrepared:Boolean(applicant?.photoDataUrl)};
  const py=asJson(asJson(payload));
  const notes=`E-VISA REFERENCE PLAN — ${fileName(applicant?.fileNumber)}\nCandidate: ${[data.personalData?.surname,data.personalData?.first_names].filter(Boolean).join(' ')||'(not entered)'}\n${target?'Target URL (review manually): '+target:'No target URL set.'}\nSelected stage: ${targetMode}\n\nNever use this plan as proof of portal submission. Login and CAPTCHA are manual. Selector IDs are examples; inspect the current official portal DOM. No supporting-document management, live browser-agent service, CDP console, or final submission is included.\n\n`;
  const details=stages.map((stage,index)=>`${index+1}. ${stage.title} [${stage.id}]\n${stage.fields.length?stage.fields.map(({key,value})=>`   ${key}: ${typeof value==='boolean'?(value?'Yes (manual control review)':'No (manual control review)'):String(value)}`).join('\n'):'   Manual review; no generated form actions.'}`).join('\n\n');
  const selenium=`"""Candidate-specific E-Visa Selenium reference. Dry-run by default.
Generated from reviewed draft only; does NOT log in, upload files or submit.
Selectors are reference candidates, not verified against the portal.
"""
import argparse
import json

PLAN = json.loads(${py})

def chosen_stages():
    mode = PLAN['mode']
    return PLAN['stages'] if mode == 'FULL_PIPELINE' else [s for s in PLAN['stages'] if s['id'] == mode]

def fill_visible_fields(driver, stage=None):
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    for stage in ([stage] if stage is not None else chosen_stages()):
        print('Review stage:', stage['title'])
        for item in stage['fields']:
            value = item['value']
            if isinstance(value, bool) or not value:
                print('Manual control review:', item['key'], value)
                continue
            try:
                element = WebDriverWait(driver, ${timeout}).until(EC.visibility_of_element_located((By.XPATH, PLAN['selectors'][item['key']])))
                if element.tag_name == 'select':
                    print('Manual dropdown review:', item['key'], value)
                    continue
                element.clear()
                element.send_keys(str(value))
                print('Filled:', item['key'])
            except Exception as exc:
                print('Review selector manually:', item['key'], type(exc).__name__)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Reviewed E-Visa Selenium reference; no final submission')
    parser.add_argument('--fill', action='store_true', help='Explicitly open local Chrome; login and CAPTCHA stay manual')
    args = parser.parse_args()
    for stage in chosen_stages():
        print(stage['title'], [(item['key'],item['value']) for item in stage['fields']])
    if not args.fill:
        print('Dry run only. No browser launched. Review every field and selector first.')
    else:
        try:
            from selenium import webdriver
        except ImportError as exc:
            raise SystemExit('Selenium is required for --fill: python -m pip install selenium') from exc
        driver = webdriver.Chrome()
        try:
            if PLAN['target']:
                driver.get(PLAN['target'])
            for stage in chosen_stages():
                input('Navigate/login manually, verify candidate and open ' + stage['title'] + '; press Enter to fill visible text fields...')
                fill_visible_fields(driver, stage)
            input('Review every field. Nothing was submitted. Press Enter to close...')
        finally:
            driver.quit()
`;
  const playwright=`"""Candidate-specific E-Visa Playwright Python script. Dry-run by default.
Optional --fill opens a LOCAL browser after explicit confirmation. No login,
CAPTCHA solving, file upload, Save/Next clicks or submission is automated.
Selectors are reference candidates; inspect the current official portal DOM.
"""
import argparse
import asyncio
import json

PLAN = json.loads(${py})

def chosen_stages():
    mode = PLAN['mode']
    return PLAN['stages'] if mode == 'FULL_PIPELINE' else [s for s in PLAN['stages'] if s['id'] == mode]

async def fill_visible_fields(page, stage=None):
    for current in ([stage] if stage is not None else chosen_stages()):
        print('Review stage:', current['title'])
        for item in current['fields']:
            value = item['value']
            if not isinstance(value, str) or not value:
                print('Manual control review:', item['key'], value)
                continue
            try:
                locator = page.locator('xpath=' + PLAN['selectors'][item['key']]).first
                if not await locator.count() or not await locator.is_visible():
                    print('Review missing selector:', item['key'])
                elif await locator.evaluate('(el) => el.tagName.toLowerCase()') == 'select':
                    print('Review dropdown manually:', item['key'], value)
                else:
                    await locator.fill(value, timeout=${timeout * 1000})
                    print('Filled:', item['key'])
            except Exception as exc:
                print('Review selector manually:', item['key'], type(exc).__name__)

async def run_local_fill():
    try:
        from playwright.async_api import async_playwright
    except ImportError as exc:
        raise SystemExit('Playwright is required for --fill: python -m pip install playwright && python -m playwright install chromium') from exc
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=False)
        try:
            page = await browser.new_page()
            if PLAN['target']:
                await page.goto(PLAN['target'])
            for stage in chosen_stages():
                await asyncio.to_thread(input, 'Navigate/login manually, verify candidate and open ' + stage['title'] + '; press Enter to fill visible text fields...')
                await fill_visible_fields(page, stage)
            await asyncio.to_thread(input, 'Review everything manually. Nothing was submitted. Press Enter to close...')
        finally:
            await browser.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Reviewed local Playwright reference; no portal submission')
    parser.add_argument('--fill', action='store_true', help='Opt in to a local browser; login, CAPTCHA and stages are manual')
    args = parser.parse_args()
    for stage in chosen_stages():
        print(stage['title'], [(item['key'], item['value']) for item in stage['fields']])
    if args.fill:
        asyncio.run(run_local_fill())
    else:
        print('Dry run only. No browser launched. Review every selector before using --fill.')
`;
  const js=`// Candidate-specific Playwright Node.js script (CommonJS .cjs). Dry run by default.
// --fill opens a LOCAL browser after manual confirmation for every stage.
// No login, CAPTCHA solving, file upload, Save/Next clicks or submission.
// Selectors are examples: check the current official portal DOM before using.
const PLAN = ${asJson(payload)};
const chosenStages = () => PLAN.mode === 'FULL_PIPELINE' ? PLAN.stages : PLAN.stages.filter(stage => stage.id === PLAN.mode);
async function fillVisibleFields(page, stage = null) {
  for (const current of stage ? [stage] : chosenStages()) {
    console.log('Review stage:', current.title);
    for (const item of current.fields) {
      if (typeof item.value !== 'string' || !item.value) {
        console.log('Manual control review:', item.key, item.value);
        continue;
      }
      try {
        const field = page.locator('xpath=' + PLAN.selectors[item.key]).first();
        if (!await field.count() || !await field.isVisible()) {
          console.log('Review missing selector:', item.key);
        } else if (await field.evaluate(el => el.tagName.toLowerCase()) === 'select') {
          console.log('Review dropdown manually:', item.key, item.value);
        } else {
          await field.fill(item.value, { timeout: ${timeout * 1000} });
          console.log('Filled:', item.key);
        }
      } catch (error) {
        console.log('Review selector manually:', item.key, error?.name || 'Error');
      }
    }
  }
}
async function runLocalFill() {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch { throw new Error('Playwright required for --fill: npm install playwright && npx playwright install chromium'); }
  const readline = require('node:readline/promises');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let browser;
  try {
    browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    if (PLAN.target) await page.goto(PLAN.target);
    for (const stage of chosenStages()) {
      await rl.question('Navigate/login manually, verify candidate and open ' + stage.title + '; press Enter to fill visible text fields...');
      await fillVisibleFields(page, stage);
    }
    await rl.question('Review everything manually. Nothing was submitted. Press Enter to close...');
  } finally {
    if (browser) await browser.close();
    rl.close();
  }
}
module.exports = { PLAN, chosenStages, fillVisibleFields };
if (require.main === module) {
  for (const stage of chosenStages()) console.log(stage.title, stage.fields.map(item => [item.key, item.value]));
  if (process.argv.includes('--fill')) runLocalFill().catch(error => { console.error(error.message); process.exitCode = 1; });
  else console.log('Dry run only. No browser launched. Review every selector before using --fill.');
}
`;
  const dropdowns=[['Current nationality',data.selection?.current_nationality||data.personalData?.current_nationality],['Country of residence',data.selection?.country_of_residence||data.personalData?.country_of_residence],['Diplomatic mission / consular post of Romania',data.selection?.diplomatic_mission],['Type of travel document',data.selection?.type_of_travel_document||data.travelDoc?.travel_document_type]].filter(([,value])=>typeof value==='string'&&value);
  const videoForm=`"""Reusable e-v dropdown reference: caller supplies an already-open Playwright Page.
Missing values are omitted. No landing-page navigation or submission.
"""
import json
DROPDOWNS = json.loads(${asJson(asJson(dropdowns))})

async def fill_dropdowns(page):
    for label, value in DROPDOWNS:
        field = page.get_by_label(label, exact=False).first
        if not await field.count():
            print('Review missing label:', label)
            continue
        if await field.evaluate('(el) => el.tagName.toLowerCase()') == 'select':
            try:
                await field.select_option(label=value)
                print('Selected:', label)
            except Exception:
                print('Review native dropdown option manually:', label, value)
            continue
        await field.click()
        try:
            await field.fill(value)
        except Exception:
            print('Review non-text dropdown manually:', label, value)
            continue
        # Upstream uses pop-out selection; confirm the option's actual accessible name.
        option = page.get_by_role('option', name=value, exact=True).first
        if await option.count(): await option.click()
        else: print('Review pop-out option manually:', label, value)
    print('Verify biometric choice and validation messages manually; no Save/Next action.')

if __name__ == '__main__':
    print('Import fill_dropdowns and pass an already-open reviewed form page.')
`;
  const fullPlan=asJson(asJson({...payload,mode:'FULL_PIPELINE'}));
  const playwrightFull=playwright.replace(`PLAN = json.loads(${py})`,`PLAN = json.loads(${fullPlan})`);
  return {plan:payload,script:selenium,playwrightFull,filename:`evisa_selenium_${fileName(applicant?.fileNumber)}.py`,playwright,playwrightJs:js,videoForm,personalDataTxt:notes+stages.filter(stage=>stage.id==='PERSONAL_DATA'||stage.id==='FAMILY_DETAILS').map(stage=>`${stage.title}\n${stage.fields.map(item=>`${item.key}: ${item.value}`).join('\n')}`).join('\n\n'),playwrightTxt:notes+details,automationStepsTxt:notes+details+'\n\nFinal step: inspect the official portal manually. No file upload or submission is generated.\n',stageCount:stages.length,fieldCount:stages.reduce((sum,stage)=>sum+stage.fields.length,0)};
}
