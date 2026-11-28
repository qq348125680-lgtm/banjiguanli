import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
let ts;
try {ts=require('typescript')} catch {
 // Allow CI environments with a global TypeScript install to run this check offline.
 const globalRoot=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();
 ts=require(resolve(globalRoot,'typescript'));
}
const source=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const sf=ts.createSourceFile('App.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function getStatements(){
 const app=sf.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='App');
 assert.ok(app?.body,'App function should be present');
 return app.body.statements;
}
function declarationPosition(name){
 for(const statement of getStatements())if(ts.isVariableStatement(statement))for(const d of statement.declarationList.declarations)
  if(ts.isIdentifier(d.name)&&d.name.text===name)return d.getStart(sf);
 return -1;
}
function callbackPosition(name){return declarationPosition(name)}
test('authorized-class state is initialized before dossier callback closure',()=>{
 const guard=declarationPosition('isAuthorizedClass');
 const callback=callbackPosition('fetchDossierPage');
 assert.ok(guard>=0&&callback>=0);
 assert.ok(guard<callback,'rendering must not evaluate an uninitialized const in useCallback dependencies');
});
test('authorized-class IDs are created before they are evaluated',()=>{
 assert.ok(declarationPosition('authorizedClassIds')<declarationPosition('isAuthorizedClass'));
});
test('TSX parse contains no syntax errors',()=>{
 assert.equal(sf.parseDiagnostics.length,0,ts.formatDiagnosticsWithColorAndContext(sf.parseDiagnostics,{
 getCanonicalFileName:x=>x,getCurrentDirectory:()=>'.',getNewLine:()=> '\n'
 }));
});
