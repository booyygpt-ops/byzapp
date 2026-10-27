import { test, expect } from '@playwright/test';

test('desktop UI imports a real repository and runs an editable example', async ({ page }) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Projelerin için bir alan.'})).toBeVisible();
  await page.screenshot({path:'test-results/home.png',fullPage:true});
  await page.getByRole('button',{name:'Depo içe aktar',exact:true}).click();
  await page.getByPlaceholder('https://github.com/kullanici/proje').fill('https://github.com/octocat/Hello-World');
  await page.getByRole('button',{name:'Depoyu içe aktar',exact:true}).click();
  await expect(page.getByRole('heading',{name:/Hello-World/})).toBeVisible();
  await expect(page.getByRole('button',{name:'README',exact:true})).toBeVisible({timeout:30000});
  await page.getByRole('button',{name:'README',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'README içeriği'})).toHaveValue(/Hello World/);
  await page.getByRole('button',{name:'Byz ana sayfa'}).click();
  // The first project exists, so create an example using the same authenticated API the UI uses.
  const id=await page.evaluate(async()=>{const token=document.querySelector('meta[name="byz-session"]').content;const r=await fetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({demo:true})});return(await r.json()).id;});
  await expect(page.getByRole('button',{name:/merhaba-byz örnek proje/})).toBeVisible();
  await page.getByRole('button',{name:/merhaba-byz örnek proje/}).click();
  await page.getByRole('button',{name:'server.cjs',exact:true}).click();
  const editor=page.getByRole('textbox',{name:'server.cjs içeriği'});
  await editor.fill((await editor.inputValue()).replace('Bir fikirle başlar.','Masaüstünden merhaba.'));
  await page.getByRole('button',{name:'Kaydet',exact:true}).click();
  await expect(page.getByText('Değişiklikler kaydedildi.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Çalıştır',exact:true}).click();
  await page.getByRole('button',{name:'Önizleme',exact:true}).click();
  await expect(page.frameLocator('iframe').getByRole('heading',{name:'Masaüstünden merhaba.'})).toBeVisible({timeout:30000});
  await page.screenshot({path:'test-results/running.png',fullPage:true});
  await page.getByRole('button',{name:'Durdur',exact:true}).click();
  await expect(page.getByRole('button',{name:'Çalıştır',exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});
