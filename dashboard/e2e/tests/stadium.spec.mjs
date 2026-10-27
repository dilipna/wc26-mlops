import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { stubMatchday } from "../matchday-fixture.mjs";

test.beforeEach(async ({page, baseURL}) => {
  await page.route("**/*", r => new URL(r.request().url()).origin === baseURL ? r.continue() : r.abort());
  await stubMatchday(page);
  await page.emulateMedia({reducedMotion:"reduce"});
});
for (const width of [1440,768,360]) test(`original charcoal and gold theme across routes at ${width}px`, async ({page}, info) => {
  await page.setViewportSize({width,height:1000});
  for (const route of ["/","/models","/basketball","/nfl","/cricket","/football","/pele","/engineering","/admin"]) {
    await page.goto(route);
    const palette = await page.evaluate(() => {
      const root=getComputedStyle(document.documentElement);
      const surface=getComputedStyle(document.querySelector('.replay-page') || document.body).backgroundColor;
      return {accent:root.getPropertyValue('--accent').trim(),surface,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    expect(palette.accent).toBe('#f0c000');
    expect(palette.surface.match(/\d+/g).slice(0,3).every(n=>Number(n)<30)).toBe(true);
    expect(palette.overflow).toBe(false);
    for (const card of await page.locator('.platform-card, .replay-panel, .replay-workspace, .matchday-detail').all()) {
      const rgb = await card.evaluate(el=>getComputedStyle(el).backgroundColor.match(/\d+/g).slice(0,3).map(Number));
      expect(rgb.every(n=>n<40)).toBe(true);
    }
  }
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Every claim has a way back.'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Play motion',exact:true})).toHaveAttribute('aria-pressed','true');
  expect(await page.locator('.arena-ball').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  const contrast = await page.locator('.stadium-actions a').first().evaluate(el=> {
    const s=getComputedStyle(el), rgb=x=>x.match(/\d+/g).slice(0,3).map(Number);
    const lum=x=>rgb(x).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
    const a=lum(s.color),b=lum(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({path:info.outputPath(`stadium-${width}.png`),fullPage:true});
});
test('sports stage changes with competition and respects pause and replay',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('/');
  for(const [name,sport] of [['NBA','Basketball'],['Premier League','Football'],['NFL','American football'],['MLB','Baseball'],['NHL','Ice hockey'],['ATP Tour','Tennis'],['Sheffield Shield','Cricket'],['Formula 1','Motorsport']]){
    await page.getByRole('button',{name:`Choose ${name}`,exact:true}).click();
    await expect(page.locator('.matchday-arena')).toHaveAttribute('data-sport',sport);
  }
  await page.getByRole('button',{name:'Pause motion',exact:true}).click();
  await expect(page.locator('.matchday-visual')).toHaveAttribute('data-paused','true');
  expect(await page.locator('.arena-route').evaluate(el=>getComputedStyle(el).animationPlayState)).toBe('paused');
  await page.getByRole('button',{name:'Replay motion ↻',exact:true}).click();
  await expect(page.locator('.matchday-visual')).toHaveAttribute('data-paused','false');
  expect(await page.locator('.arena-route').evaluate(el=>getComputedStyle(el).animationPlayState)).toBe('running');
});
for (const hidden of [false,true]) test(`source receipt preserves provenance and spoiler state ${hidden}`,async({page},info)=>{
  await page.goto('/');
  await expect(page.locator('#match-detail-title')).toHaveText('Fixture North vs Fixture South');
  if(hidden) await page.getByLabel('Hide results · spoiler protection').check();
  await page.getByText('Check this match record',{exact:true}).click();
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download source receipt ↓',exact:true}).click()]);
  const receipt=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  expect(receipt.match.sourceUrl).toBe('https://www.thesportsdb.com/event/9999991');
  expect(receipt.fetchedAt).toBeTruthy();
  expect(receipt.provider).toBeTruthy();
  if(hidden){expect(receipt.match.result).toBe('Hidden by spoiler protection');expect(Object.keys(receipt.match).sort()).toEqual(['date','id','result','sourceUrl','title']);}
  else {expect(receipt.match.title).toBe('Fixture North vs Fixture South');expect(receipt.match.state).toBe('finished');}
  await download.saveAs(info.outputPath(`source-receipt-${hidden}.json`));
});
test('proof center links to verifiable models, decisions and exact build receipt',async({page})=>{
  await page.goto('/');
  const proof=page.locator('#platform-proof');
  await expect(proof.locator('.proof-number').first()).toHaveText('1,635');
  await expect(proof.getByRole('link',{name:/Historical matches/})).toHaveAttribute('href','/models');
  await expect(proof.getByRole('link',{name:/Better evidence beats/})).toHaveAttribute('href','/engineering');
  const response=await page.request.get('/release.json');
  expect(response.ok()).toBe(true);
  expect((await response.json()).source_commit).toBe(process.env.SPOPS_EXPECTED_COMMIT);
  await expect(proof.locator('a[download="spops-release.json"]')).toHaveAttribute('href','/release.json');
});
