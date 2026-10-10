import test from "node:test";
import assert from "node:assert/strict";
const values=new Map<string,string>([["visitkort-language","da"]]);
Object.assign(globalThis,{location:{pathname:"/p/"+"a".repeat(64)},localStorage:{getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>values.set(key,value)},document:{documentElement:{lang:""}}});
const {getLanguage,setLanguage,tr,trf}=await import("../src/i18n.tsx");
test("a public card opens in English despite a Danish private preference",()=>{
 assert.equal(getLanguage(),"en");
 assert.equal(tr("Gem i mine kontakter"),"Save to my contacts");
 assert.equal(document.documentElement.lang,"en");
});
test("language choices persist and interpolation preserves personal details",()=>{
 setLanguage("da");assert.equal(tr("Kontakter"),"Kontakter");
 setLanguage("en");assert.equal(values.get("visitkort-language"),"en");
 assert.equal(trf("Hej {name}.",{name:"Sørensen"}),"Hello Sørensen.");
 assert.equal(tr("Jacob Nitter Sørensen"),"Jacob Nitter Sørensen");
 assert.equal(tr("I dialog"),"In conversation");
});
