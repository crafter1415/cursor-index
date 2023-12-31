/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable curly */
import * as vscode from 'vscode';

import localeEn from "./package.nls.json";
import localeJa from "./package.nls.ja.json";

export type LocaleKeyType = keyof typeof localeEn;

interface LocaleEntry
{
    [key : string] : string;
}
const localeTableKey = vscode.env.language;
const localeTable = Object.assign(localeEn, ((<{[key : string] : LocaleEntry}>{
    ja : localeJa
})[localeTableKey] || { }));
const localeString = (key : string) : string => localeTable[key] || key;
const localeMap = (key : LocaleKeyType) : string => localeString(key);

function getSelections(editor: vscode.TextEditor) {
	var initialSelections = editor?.selections;
	return initialSelections;
}

function validate(formula: string): string | undefined {
	var resolved = resolve(formula);
	return resolved.type === "formula"
			? undefined
			: localeMap("cursor-index.map.error")
					.replace("{0}", localeMap(resolved.message))
					.replace("{1}", (resolved.location+1).toString());
}
function getArgs(x: number, i: number): {[K: string]: number} {
	return {
		E: Math.E,
		LN2: Math.LN2,
		LN10: Math.LN10,
		LOG2E: Math.LOG2E,
		LOG10E: Math.LOG10E,
		PI: Math.PI,
		SQRT1_2: Math.SQRT1_2,
		SQRT2: Math.SQRT2,
		x: x,
		i: i
	};
}
interface Value {
	getAsNumber(): number | null;
	getAsArray(): RelativeIndexable<Value> | null;
	isEmpty(): boolean;
	toString(): string;
}
class Values {
	static of(x: number): Value;
	static of(x: RelativeIndexable<Value>): Value;
	static of(): Value;
	static of(x?: number | RelativeIndexable<Value>): Value {
		if (typeof x === "number") {
			return {
				getAsArray: () => null,
				getAsNumber: () => x,
				isEmpty: () => false,
				toString: () => x.toString()
			};
		} else if (typeof x === "object") {
			return {
				getAsArray: () => x,
				getAsNumber: () => null,
				isEmpty: () => false,
				toString: () => x.toString()
			};
		} else {
			return {
				getAsArray: () => null,
				getAsNumber: () => null,
				isEmpty: () => true,
				toString: () => ""
			};
		}
	}
}

interface FormulaNode {
	type: "formula";
	solve(args: {[K: string]: number}): Value;
}
class UnaryOperationNode implements FormulaNode {
	type: "formula" = "formula";
	right: FormulaNode;
	operator: string;
	constructor (right: FormulaNode, operator: string) {
		this.right=right;
		this.operator=operator;
	}
	solve(args: {[K: string]: number}): Value {
		var right = this.right.solve(args).getAsNumber();
		if (right === null) return Values.of();
		switch (this.operator) {
			case '-': return Values.of(-right);
			case '~': return Values.of(~right);
			default: return Values.of();
		}
	}
}
class BinaryOperationNode implements FormulaNode {
	type: "formula" = "formula";
	left: FormulaNode;
	right: FormulaNode;
	operator: string;
	constructor (left: FormulaNode, right: FormulaNode, operator: string) {
		this.left=left;
		this.right=right;
		this.operator=operator;
	}
	solve(args: {[K: string]: number}): Value {
		var left = this.left.solve(args).getAsNumber();
		var right = this.right.solve(args).getAsNumber();
		if (left === null || right === null) return Values.of();
		switch (this.operator) {
			case '+': return Values.of(left+right);
			case '-': return Values.of(left-right);
			case '*': return Values.of(left*right);
			case '/': return Values.of(left/right);
			case '**': return Values.of(left**right);
			case '%': return Values.of(left%right);
			case '|': return Values.of(left|right);
			case '&': return Values.of(left&right);
			case '^': return Values.of(left^right);
			case '||': return Values.of(left||right);
			case '&&': return Values.of(left&&right);
			case '<<': return Values.of(left<<right);
			case '>>': return Values.of(left>>right);
			case '>>>': return Values.of(left>>>right);
			case '==': return Values.of(left===right?1:0);
			case '<=': return Values.of(left<=right?1:0);
			case '>=': return Values.of(left>=right?1:0);
			case '<': return Values.of(left<right?1:0);
			case '>': return Values.of(left>right?1:0);
			default: return Values.of();
		}
	}
}
class TernaryOperationNode implements FormulaNode {
	type: "formula" = "formula";
	left: FormulaNode;
	mid: FormulaNode;
	right: FormulaNode;
	// 三項演算子のみなのでOperatorは不要
	constructor (left: FormulaNode, mid: FormulaNode, right: FormulaNode) {
		this.left=left;
		this.mid=mid;
		this.right=right;
	}
	solve(args: {[K: string]: number}): Value {
		var left = this.left.solve(args).getAsNumber();
		return left===null?Values.of():
				left?this.mid.solve(args):this.right.solve(args);
	}
}
class ConstantNode implements FormulaNode {
	type: "formula" = "formula";
	value: number;
	constructor(value: number) {
		this.value=value;
	}
	solve(args: object): Value {
		return Values.of(this.value);
	}
}
class DelayedArray implements RelativeIndexable<Value> {
	source: FormulaNode[];
	args: { [K: string]: number; };
	constructor(source: FormulaNode[], args: { [K: string]: number; }) {
		this.source = source;
		this.args = args;
	}
	at(index: number): Value | undefined {
		return this.source[index]?.solve(this.args);
	}
	toString = ()=>this.source.map(x=>x.solve(this.args).toString()).toString();
}
class ArrayNode implements FormulaNode {
	type: "formula" = "formula";
	value: FormulaNode[];
	constructor(value: FormulaNode[]) {
		this.value=value;
	}
	solve(args: { [K: string]: number; }): Value {
		return Values.of(new DelayedArray(this.value, args));
	}
}
class ArgumentNode implements FormulaNode {
	type: "formula" = "formula";
	name: string;
	constructor(name: string) {
		this.name=name;
	}
	solve(args: {[K: string]: number}): Value {
		return args[this.name] !== undefined ? Values.of(args[this.name]) : Values.of();
	}
}
class ArrayIndexNode implements FormulaNode {
	type: "formula" = "formula";
	array: FormulaNode;
	index: FormulaNode;
	constructor(array: FormulaNode, index: FormulaNode) {
		this.array=array;
		this.index=index;
	}
	solve(args: { [K: string]: number; }): Value {
		var obj = this.array.solve(args).getAsArray();
		var index = this.index.solve(args).getAsNumber();
		if (obj === null || index === null) return Values.of();
		return obj.at(index) === undefined ? Values.of() : obj.at(index)!;
	}
}
class FunctionNode implements FormulaNode {
	type: "formula" = "formula";
	name: string;
	args: FormulaNode[];
	constructor(name: string, args: FormulaNode[]) {
		this.name=name;
		this.args=args;
	}
	solve(args: { [K: string]: number; }): Value {
		var values: number[] = [];
		for (var arg of this.args) {
			var got = arg.solve(args).getAsNumber();
			if (got === null) return Values.of();
			values.push(got);
		}
		switch (this.name) {
			// 0 arg
			case "random":
				return Values.of(Math.random());
			// 1 arg
			case "abs":
			case "acos":
			case "acosh":
			case "asin":
			case "asinh":
			case "atan":
			case "atanh":
			case "cbrt":
			case "ceil":
			case "clz32":
			case "cos":
			case "cosh":
			case "exp":
			case "expm1":
			case "floor":
			case "fround":
			case "log":
			case "log1p":
			case "log10":
			case "log2":
			case "round":
			case "sign":
			case "sin":
			case "sinh":
			case "sqrt":
			case "tan":
			case "tanh":
			case "trunc":
				return Values.of(Math[this.name](values[0]));
			// 2 arg
			case "atan2":
			case "imul":
			case "pow":
				return Values.of(Math[this.name](values[0], values[1]));
			// ... arg
			case "hypot":
			case "max":
			case "min":
				return Values.of(Math[this.name](...values));
		}
		return Values.of();
	}
}
interface Error {
	type: "error";
	message: LocaleKeyType;
	location: number
}
class Errors {
	static of(message: LocaleKeyType, location: number): Error {
		return {
			type: "error",
			message: message,
			location: location
		};
	}
}
function resolve(str: string): FormulaNode | Error {
	if (str.length === str.trim().length)
		return resolveTrimmed(str);
	var prefix = str.length - str.trimStart().length;
	var result = resolveTrimmed(str.trim());
	return result.type === "formula"
			? result
			: {
				type: "error",
				message: result.message,
				location: result.location + prefix
			};
}

function resolveTrimmed(str: string): FormulaNode | Error {
	var tmp = validateParentheses(str);
	if (tmp !== null) return tmp;
	if (str === "") return Errors.of("cursor-index.map.error.empty", 0);
	var buf;
	if ((buf=resolveOp(str, ["","?",":"])).match
			|| (buf=resolveOp(str, ["","||"])).match
			|| (buf=resolveOp(str, ["","&&"])).match
			|| (buf=resolveOp(str, ["","|"])).match
			|| (buf=resolveOp(str, ["","^"])).match
			|| (buf=resolveOp(str, ["","&"])).match
			|| (buf=resolveOp(str, ["","=="])).match
			|| (buf=resolveOp(str, ["","<="])).match
			|| (buf=resolveOp(str, ["",">="])).match
			|| (buf=resolveOp(str, ["","<"])).match
			|| (buf=resolveOp(str, ["",">"])).match
			|| (buf=resolveOp(str, ["","<<"])).match
			|| (buf=resolveOp(str, ["",">>"])).match
			|| (buf=resolveOp(str, ["",">>>"])).match
			|| (buf=resolveOp(str, ["","+"])).match
			|| (buf=resolveOp(str, ["","-"])).match
			|| (buf=resolveOp(str, ["","*"])).match
			|| (buf=resolveOp(str, ["","/"])).match
			|| (buf=resolveOp(str, ["","%"])).match
			|| (buf=resolveOp(str, ["","**"])).match
			|| (buf=resolveOp(str, ["~"])).match
			|| (buf=resolveOp(str, ["!"])).match) {
		return buf.value;
	}
	if (str.startsWith("(") && str.endsWith(")"))
		return resolve(str.substring(1, str.length-1));
	if (str.endsWith("]")) {
		var index_ = lookupBackward(str, "[");
		if (index_ === 0) {
			// 配列そのもの
			var sub = str.substring(1, str.length-1);
			var index = lookupAll(sub, ",");
			var array = [];
			if (sub !== "") {
				for (let i=-1;i<index.length;i++) {
					var from = i===-1?0:index[i]+1;
					var to = i+1===index.length?sub.length:index[i+1];
					var item = sub.substring(from, to);
					var resolved = resolve(item);
					if (resolved.type === "error") return Errors.of(resolved.message, resolved.location+from);
					array.push(resolved);
				}
			}
			return new ArrayNode(array);
		} else {
			// 配列+アクセッサー
			var objs = [
				[0, index_],
				[index_+1, str.length-1]
			];
			var resolved_ = [];
			for (var entry of objs) {
				var item_ = resolve(str.substring(entry[0], entry[1]));
				if (item_.type === "error")
					return Errors.of(item_.message, item_.location+entry[0]);
				resolved_.push(item_);
			}
			return new ArrayIndexNode(resolved_[0], resolved_[1]);
		}
	}
	if (str.endsWith(")")) {
		var matched = /^([a-zA-Z0-9_]+)\((.*)\)$/.exec(str);
		if (matched === null) return Errors.of("cursor-index.map.error.function.invalid", 0);
		var args = matched[2];
		var index = lookupAll(matched[2], ",");
		var array = [];
		if (matched[2] !== "") {
			for (let i=-1;i<index.length;i++) {
				var from = i===-1?0:index[i];
				var to = i+1===index.length?matched[2].length:index[i+1];
				var item = matched[2].substring(from, to);
				var resolved = resolve(item);
				if (resolved.type === "error") return Errors.of(resolved.message, resolved.location+from);
				array.push(resolved);
			}
		}
		switch (matched[1]) {
			// 0 arg
			case "random":
				if (array.length !== 0) return Errors.of("cursor-index.map.error.function.argument", 0);
				break;
			// 1 arg
			case "abs":
			case "acos":
			case "acosh":
			case "asin":
			case "asinh":
			case "atan":
			case "atanh":
			case "cbrt":
			case "ceil":
			case "clz32":
			case "cos":
			case "cosh":
			case "exp":
			case "expm1":
			case "floor":
			case "fround":
			case "log":
			case "log1p":
			case "log10":
			case "log2":
			case "round":
			case "sign":
			case "sin":
			case "sinh":
			case "sqrt":
			case "tan":
			case "tanh":
			case "trunc":
				if (array.length !== 1) return Errors.of("cursor-index.map.error.function.argument", 0);
				break;
			// 2 arg
			case "atan2":
			case "imul":
			case "pow":
				if (array.length !== 2) return Errors.of("cursor-index.map.error.function.argument", 0);
				break;
			// ... arg
			case "hypot":
			case "max":
			case "min":
				break;
			default:
				return Errors.of("cursor-index.map.error.function.dne", 0);
		}
		return new FunctionNode(matched[1], array);
	}
	var variable = /^[A-Za-z_][A-Za-z0-9_]*$/.exec(str);
	if (variable !== null)
		return new ArgumentNode(variable[0]);
	var number = Number(str);
	return Number.isNaN(number) 
			? Errors.of("cursor-index.map.error.unparsable", 0)
			: new ConstantNode(number);
}
function resolveOp(str: string, operator: string[]): {match: false} | {match: true, value: FormulaNode | Error} {
	s:
	switch (operator.length) {
		case 1:
			if (!str.startsWith(operator[0])) break;
			var obj = resolve(str.substring(operator[0].length));
			if (obj.type === "error") return {match: true, value: Errors.of(obj.message, obj.location+operator[0].length)};
			return {match: true, value: new UnaryOperationNode(obj, operator[0])};
		case 2:
			var index = lookupBackward(str, operator[1]);
			if (index === -1) break;
			var objs = [
				[0, index],
				[index+operator[1].length]
			];
			var resolved = [];
			for (var entry of objs) {
				var item = resolve(str.substring(entry[0], entry[1]));
				if (item.type === "error") {
					if (operator[1] === "*") break s;
					return {match: true, value: Errors.of(item.message, item.location+entry[0])};
				}
				resolved.push(item);
			}
			return {match: true, value: new BinaryOperationNode(resolved[0], resolved[1], operator[1])};
		case 3:
			var index0 = lookupBackward(str, operator[1]);
			var index1 = lookupBackward(str, operator[2]);
			if (index0 === -1 && index1 === -1) break;
			if (index0 === -1 || index1 === -1) return {match: true, value: Errors.of("cursor-index.map.error.unparsable", 0)};
			objs = [
				[0, index0],
				[index0+operator[1].length, index1],
				[index1+operator[2].length]
			];
			resolved = [];
			for (var entry of objs) {
				var item = resolve(str.substring(entry[0], entry[1]));
				if (item.type === "error")
					return {match: true, value: Errors.of(item.message, item.location+entry[0])};
				resolved.push(item);
			}
			return {match: true, value: new TernaryOperationNode(resolved[0], resolved[1], resolved[2])};
	}
	return {match: false};
}
function validateParentheses(str: string): Error | null {
	var stack: string[] = [];
	for (let i=0;i<str.length;i++) {
		switch (str.charAt(i)) {
			case '(':
				stack.push('(');
				break;
			case '[':
				stack.push('[');
				break;
			case ')':
				if (stack.length === 0) return Errors.of("cursor-index.map.error.parentheses", i);
				if (stack.pop() !== '(') return Errors.of("cursor-index.map.error.parentheses", i);
				break;
			case ']':
				if (stack.length === 0) return Errors.of("cursor-index.map.error.parentheses", i);
				if (stack.pop() !== '[') return Errors.of("cursor-index.map.error.parentheses", i);
				break;
		}
	}
	return null;
}
function lookupAll(str: string, key: string): number[] {
	var depth = 0;
	var result = [];
	for (let i=0;i<str.length;i++) {
		switch (str.charAt(i)) {
			case '(':
			case '[':
				depth++;
				break;
			case ')':
			case ']':
				depth--;
				break;
		}
		if (depth !== 0) continue;
		if (!str.startsWith(key, i)) continue;
		result.push(i);
	}
	return result;
}
function lookupBackward(str: string, key: string): number {
	var depth = 0;
	for (let i=str.length-1;0<=i;i--) {
		switch (str.charAt(i)) {
			case '(':
			case '[':
				depth--;
				break;
			case ')':
			case ']':
				depth++;
				break;
		}
		if (depth !== 0) continue;
		if (!str.startsWith(key, i)) continue;
		return i;
	}
	return -1;
}



export function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(vscode.commands.registerCommand('cursor-index.commands.index', () => {
		var editor = vscode.window.activeTextEditor;
		if (editor === undefined) return;
		
		editor?.edit(function (builder) {
			getSelections(editor!).forEach(function (selection, index) {
				builder.replace(selection, index.toString());
			});
		});
	}));
	context.subscriptions.push(vscode.commands.registerCommand('cursor-index.commands.incr', () => {
		var editor = vscode.window.activeTextEditor;
		if (editor === undefined) return;
		
		editor?.edit(function (builder) {
			getSelections(editor!).forEach(function (selection, i) {
				var x = Number(editor?.document.getText(selection));
				builder.replace(selection, (x+1).toString());
			});
		});
	}));
	context.subscriptions.push(vscode.commands.registerCommand('cursor-index.commands.decr', () => {
		var editor = vscode.window.activeTextEditor;
		if (editor === undefined) return;
		
		editor?.edit(function (builder) {
			getSelections(editor!).forEach(function (selection, i) {
				var x = Number(editor?.document.getText(selection));
				builder.replace(selection, (x-1).toString());
			});
		});
	}));
	context.subscriptions.push(vscode.commands.registerCommand('cursor-index.commands.map', () => {
		var editor = vscode.window.activeTextEditor;
		if (editor === undefined) return;
		
		vscode.window.showInputBox({
			validateInput: validate,
			placeHolder: "x => ?"
		}).then(s => {
			if (s === undefined) return;
			var formula = resolve(s);
			if (formula.type === "error") {
				vscode.window.showErrorMessage(localeMap("cursor-index.commands.map.error")
						.replace("{0}", localeMap(formula.message)));
				return;
			}
			editor?.edit(function (builder) {
				getSelections(editor!).forEach(function (selection, i) {
					var x = Number(editor?.document.getText(selection));
					var result = (formula as FormulaNode).solve(getArgs(x, i));
					builder.replace(selection, result.toString());
				});
			});
		});
	}));
}

export function deactivate() {}
