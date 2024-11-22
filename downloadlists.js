import fs from "fs";

(async () => {
    let allPages = [];
    let allProblems = [];
    let numPages = 16000;

    let validProblem = (problem) => problem.match(/^\d{4}[\s_].*[\s_][Pp]roblems\/[Pp]roblem [A-Z]?\d+$/);

    let computeTest = (problem) => problem
        .match(/(\d{4}[_\s])(.*)([\s_][Pp]roblems)/)[2]
        .replace(/AMC (10|12)[A-Z]/, "AMC $1")
        .replace(/AIME I+/, "AIME")
        .replace(/AJHSME/, "AMC 8");
    let computeYear = (problem) => problem.match(/^\d{4}/)[0];
    let computeNumber = (problem) => problem.match(/\d+$/)[0];

    let sortProblems = (problems) => problems.sort(
        (a, b) =>
            Math.sign(computeYear(a) - computeYear(b)) ||
            computeTest(a).localeCompare(computeTest(b)) ||
            Math.sign(computeNumber(a) - computeNumber(b))
    );

    console.log("Preloading all wiki pages, allow around 15 seconds...");
    let apiEndpoint = "https://artofproblemsolving.com/wiki/api.php";
    let params = `action=query&list=allpages&aplimit=max&format=json`;
    let json = null;
    do {
        console.log(`${Math.round((allPages.length / numPages) * 100)}% loaded...`);
        const paramsContinue = params + (json ? `&apcontinue=${json.continue.apcontinue}` : ``);
        //console.log(paramsContinue)
        let response = await fetch(`${apiEndpoint}?${paramsContinue}&origin=*`);
        json = await response.json();
        for (let page of json?.query.allpages) {
            if (page.title.charAt(0) !== "/") allPages.push(page.title);
            if (validProblem(page.title)) allProblems.push(page.title);
        }
    } while (json?.continue)
    console.log(`Finished loading Special:AllPages (${allPages.length} pages).`);

    allProblems = sortProblems([...new Set(allProblems)]);
    allPages = [...new Set(allPages)];
    try {
        fs.writeFileSync(
            "data/allpages.json",
            JSON.stringify(allPages, undefined, 2)
        );
        fs.writeFileSync(
            "data/allproblems.json",
            JSON.stringify(allProblems, undefined, 2)
        );
    } catch (err) {
        console.error(err);
    }
    try {
        let roundedLength = Math.ceil(allPages.length / 500) * 500;
        let code = fs.readFileSync("downloadlists.js", "utf8");
        code = code.replace(
            /let numPages = \d*?;/,
            `let numPages = ${roundedLength};`
        );
        fs.writeFileSync("downloadlists.js", code);
    } catch (err) {
        console.error(err);
    }
})();
