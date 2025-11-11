import * as monaco from "./monaco/index.js";

const editor = await monaco.setup(document.querySelector("#editor"), {
    root: "/monaco",
    theme: monaco.theme.dark
});

monaco.script.create("main.ts", "// Hello!");
monaco.script.open("main.ts");