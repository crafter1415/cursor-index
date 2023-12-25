// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';


function getSelections(editor: vscode.TextEditor) {
	var initialSelections = editor?.selections;
	return initialSelections;
}

function validate(formula: string): boolean {
	return resolve(formula) !== null;
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
				toString: x.toString
			};
		} else if (typeof x === "object") {
			return {
				getAsArray: () => x,
				getAsNumber: () => null,
				isEmpty: () => false,
				toString: x.toString
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
	solve(args: {[K: string]: number}): Value;
}
class UnaryOperationNode implements FormulaNode {
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
	value: FormulaNode[];
	constructor(value: FormulaNode[]) {
		this.value=value;
	}
	solve(args: { [K: string]: number; }): Value {
		return Values.of(new DelayedArray(this.value, args));
	}
}
class ArgumentNode implements FormulaNode {
	name: string;
	constructor(name: string) {
		this.name=name;
	}
	solve(args: {[K: string]: number}): Value {
		return args[this.name] !== undefined ? Values.of(args[this.name]) : Values.of();
	}
}
class ArrayIndexNode implements FormulaNode {
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
function resolve(str: string): FormulaNode | null {
	str=str.trim();
	if (!validateParentheses(str)) return null;
	if (str === "") return null;
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
	if (str.startsWith("[") && str.endsWith("]")) {
		var index = lookupAll(str, "]");
		if (index.length === 1) {
			// 配列そのもの
			var sub = str.substring(1, str.length-1);
			index = lookupAll(sub, ",");
			var array = [];
			for (let i=-1;i<index.length;i++) {
				var item = sub.substring(i===-1?0:index[i], i+1===index.length?sub.length:index[i+1]);
				var resolved = resolve(item);
				if (resolved === null) return null;
				array.push(resolved);
			}
			return new ArrayNode(array);
		} else {
			// 配列+アクセッサー
			var obj = resolve(str.substring(0, index[index.length-1]+1));
			var accessor = resolve(str.substring(index[index.length-1]+2, str.length-1));
			if (obj === null || accessor === null) return null;
			return new ArrayIndexNode(obj, accessor);
		}
	}
	if (str.endsWith(")")) {
		var matched = /^([a-zA-Z0-9_]+)\((.*)\)$/.exec(str);
		if (matched === null) return null;
		var args = matched[2];
		var index = lookupAll(matched[2], ",");
		var array = [];
		if (matched[2] !== "") {
			for (let i=-1;i<index.length;i++) {
				var item = matched[2].substring(i===-1?0:index[i], i+1===index.length?matched[2].length:index[i+1]);
				var resolved = resolve(item);
				if (resolved === null) return null;
				array.push(resolved);
			}
		}
		switch (matched[1]) {
			// 0 arg
			case "random":
				if (array.length !== 0) return null;
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
				if (array.length !== 1) return null;
				break;
			// 2 arg
			case "atan2":
			case "imul":
			case "pow":
				if (array.length !== 2) return null;
				break;
			// ... arg
			case "hypot":
			case "max":
			case "min":
				break;
			default:
				return null;
		}
		return new FunctionNode(matched[1], array);
	}
	var variable = /^[A-Za-z_][A-Za-z0-9_]*$/.exec(str);
	if (variable !== null)
		return new ArgumentNode(variable[0]);
	var number = Number(str);
	return Number.isNaN(number) ? null : new ConstantNode(number);
}
function resolveOp(str: string, operator: string[]): {match: false} | {match: true, value: FormulaNode | null} {
	switch (operator.length) {
		case 1:
			if (!str.startsWith(operator[0])) break;
			var obj = resolve(str.substring(operator[0].length));
			if (obj === null) return {match: true, value: null};
			return {match: true, value: new UnaryOperationNode(obj, operator[0])};
		case 2:
			var index = lookupBackward(str, operator[1]);
			if (index === -1) break;
			var objs = [
				resolve(str.substring(0, index)),
				resolve(str.substring(index+1))
			];
			for (var obj of objs)
				if (obj === null) return {match: true, value: null};
			return {match: true, value: new BinaryOperationNode(objs[0]!, objs[1]!, operator[1])};
		case 3:
			var index0 = lookupBackward(str, operator[1]);
			var index1 = lookupBackward(str, operator[2]);
			if (index0 === -1 && index1 === -1) break;
			objs = [
				resolve(str.substring(0, index0)),
				resolve(str.substring(index0+1, index1)),
				resolve(str.substring(index1+1))
			];
			for (var obj of objs)
				if (obj === null) return {match: true, value: null};
			return {match: true, value: new TernaryOperationNode(objs[0]!, objs[1]!, objs[2]!)};
	}
	return {match: false};
}
function validateParentheses(str: string): boolean {
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
				if (stack.length === 0) return false;
				if (stack.pop() !== '(') return false;
				break;
			case ']':
				if (stack.length === 0) return false;
				if (stack.pop() !== '[') return false;
				break;
		}
	}
	return true;
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



// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

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
			validateInput: s=>validate(s)?undefined:"Syntax Error",
			placeHolder: "x => ?"
		}).then(s => {
			if (s === undefined) return;
			var formula = resolve(s);
			if (formula === null) {
				vscode.window.showErrorMessage("Failed to parse given formula");
				return;
			}
			editor?.edit(function (builder) {
				getSelections(editor!).forEach(function (selection, i) {
					var x = Number(editor?.document.getText(selection));
					var result = formula!.solve(getArgs(x, i));
					builder.replace(selection, result.toString());
				});
			});
			});

		editor?.edit(function (builder) {
			getSelections(editor!).forEach(function (selection, i) {
				var x = Number(editor?.document.getText(selection));
				builder.replace(selection, (x+1).toString());
			});
		});
	}));
}

// This method is called when your extension is deactivated
export function deactivate() {}
