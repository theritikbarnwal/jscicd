const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const jobs = [];
    const baseUrl = "https://careers.servicenow.com/jobs/";

    const experienceRegex = /\b(?:at least\s*\d+\+?\s*years?|minimum\s*\d+\+?\s*years?|\d+\+?\s*years?|one year|two years?|three years?|four years?|five years?|six years?|seven years?|eight years?|nine years?|ten years?)\b/gi;

    for (let pageNum = 1; pageNum <= 2; pageNum++) {
        const url = `${baseUrl}?page=${pageNum}#results`;
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });

            await page.waitForFunction(() => {
                const cards = document.querySelectorAll('div.card.card-job');
                return Array.from(cards).some(card => card.innerText.trim().length > 0);
            }, { timeout: 10000 });

            const jobCards = await page.$$('div.card.card-job');

            for (let card of jobCards) {
                let job_name = "NONE";
                let job_loc = "NONE";
                let job_desc = "not mentioned";
                let experience = "not mentioned";

                try {
                    job_name = await card.$eval('h2.card-title', el => el.innerText.trim());
                } catch {}

                try {
                    job_loc = await card.$eval('li.list-inline-item', el => el.innerText.trim());
                } catch {}

                let jobLink = "";
                try {
                    const link = await card.$('a[href]');
                    const href = await link.getAttribute('href');
                    job_desc = `https://careers.servicenow.com${href}`;
                    jobLink = job_desc;
                } catch {}

                if (jobLink) {
                    try {
                        const jobPage = await browser.newPage();
                        await jobPage.goto(jobLink, { waitUntil: 'domcontentloaded' });

                        const pageText = await jobPage.innerText('body');
                        const matches = pageText.match(experienceRegex);
                        if (matches) {
                            experience = [...new Set(matches)].join(', ');
                        }

                        await jobPage.close();
                    } catch (e) {
                        console.log(`Error reading job page ${jobLink}: ${e}`);
                    }
                }

                jobs.push({
                    Job: job_name,
                    Location: job_loc,
                    Experience: experience,
                    'Job Description': job_desc,
                    'ServiceNow Page': pageNum,
                });
            }

            console.log(`Scraped page ${pageNum}`);
        } catch (err) {
            console.log(`Failed on page ${pageNum}`);
        }
    }

    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '_');  // Format timestamp to be file-safe
    const filename = `jobs_${timestamp}.json`;  // Include timestamp in the filename

    await browser.close();
    fs.writeFileSync(filename, JSON.stringify(jobs, null, 2));
    console.log(`Saved ${jobs.length} jobs to ${filename}`);
})();
