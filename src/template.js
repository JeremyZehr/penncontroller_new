import { debug } from './debug'
import { items } from './order'
import { Trial, pushItemsInNewTrial } from './trial'

const tables = {};
const DELIMITERS = [',','\t',';','\\|'];
class Table {
  static strip(text,delimiter) { // process the regexp-delimiter-parsed header and rows
    return (text||"")
              .replace(new RegExp(`^${delimiter}`), '')   // remove delimiter at the start
              .replace(/^"(([^"]|\\")+)"$/, "$1")         // remove double quotes
              .replace(/^'(([^']|\\')+)'$/, "$1");        // remove single quotes
  }
  constructor(name){ 
    this.name = name;
    this._filters = []; // functions to be pushed by the filter method
    this._latin = 'latin';
    this._group_name = 'group';
  }
  setAndParseContent(content){
    this._content = content;
    if (!this._content || typeof(this._content)!="string") throw Error(`Table ${this.name} has invalid content (${this._content})`);
    this._header = [];
    this._regex = null;
    const lines = this._content.split(/[\n\r]+/);
    if (lines.length<2) throw Error(`Table ${this.name} has too few rows (${lines.length}, should be >=2)`);
    // Remove all extra empty lines
    while (lines[lines.length-1].match(/^\W*$/)) lines.pop();
    // Find the delimiter that outputs the max number of columns
    let chosen_delimiter = '';
    DELIMITERS.forEach(d=>{
      const rgx = new RegExp(`(^|${d})("([^"]|\\")*"|'([^']|\\')*'|[^${d}]*)`,'g');
      const cols = lines[0].match(rgx), firstline = lines[1].match(rgx);
      // Must be consistent (same # of cells for header & 1st row) and exhaustive (regexp captures all chars)
      if (cols && firstline && cols.length == firstline.length && cols.length > this._header.length && cols.join('').length==lines[0].length){
        this._header = cols.map(c=>Table.strip(c,d));
        this._regex = rgx;
        chosen_delimiter = d;
      }
    });
    lines.shift();  // remove header from lines
    this._rows = lines.map( l=>(l.match(this._regex)||[]).map(c=>Table.strip(c,chosen_delimiter)) );
    this._rows = this._rows.filter( r=>r.length>0 );
    return this;
  }
  _rowAsObject(row,n) { 
    const o = {};
    for (let h of this._header) o[h] = '';
    for (let i in row) o[this._header[i]] = row[i];
    this._rowNumber.set(o,parseInt(n)+1);
    return o;
  }
  get groups() { 
    const group_column_index = this._header.findIndex(v=>v.toLowerCase()==this._group_name.toLowerCase());
    if (group_column_index < 0) return [];
    const group_names = {};
    // Use object keys to prevent duplicate entries + faster than push
    for (let row of this._rows) group_names[row[group_column_index]]=1;
    return Object.keys(group_names).sort();
  }
  get group() { 
    let counter = window.__counter_value_from_server__;
    if (window.counterOverride && !isNaN(parseInt(window.counterOverride))) counter = parseInt(window.counterOverride);
    const groups = this.groups;
    return groups[counter % groups.length];
  }
  get rows() {
    this._rowNumber = new Map(); // associate row references to their row number in the original table
    let rows = new Array(this._rows.length);
    for (let i in this._rows) rows[i] = this._rowAsObject(this._rows[i],i);
    for (let f of this._filters.filter(fn=>fn instanceof Function)) rows = rows.filter(f);
    const group_column_name = this._header.find(v=>v.toLowerCase()==this._group_name.toLowerCase());
    if (group_column_name===undefined) return rows;
    const group = this.group;
    return rows.filter( r=>r[group_column_name]==group );
  }
  setLabel(l) { this._label = l; return this; }
  setGroup(g) { this._group_name = g; return this; }
  setItem(i) { this._item = i; return this; }
  setList(l) { this._group_name = l; return this; }
  setLatin(l) { this._latin = l; return this; }
  filter(a1,a2) {
    let f = ()=>true;
    if (a1 instanceof Function) f = a1;
    else if (typeof(a1)=="string")
      f = row => {
        if (!row.hasOwnProperty(a1)) return debug.error("Attempted to filter table "+this.name+" but no column named '"+a1+"' was found.");
        if (a2 instanceof RegExp) return row[a1].match(a2);
        else return row[a1] == a2;
      }
    this._filters.push(f);
    return this;
  }
}
// manually set the content of a new table
export const addTable = (name,content) => {
  if (!name || typeof(name)!="string") throw Error("Invalid name for new table ("+name+")");
  if (tables.hasOwnProperty(name)) debug.warning(`A table named ${name} already exists; overwriting it via AddTable`);
  tables[name] = content;
  return new Table(name,content);
}
export const getTable = name => {
  if (!name || typeof(name)!="string") throw Error("Invalid name for getTable ("+name+")");
  return new Table(name);
};

export class Template {
  constructor(table_ref_or_name,fn){
    if (table_ref_or_name instanceof Table) {
      this.table = table_ref_or_name;
      this.table_name = this.table.name;
    }
    else if (typeof(table_ref_or_name) == "string")
      this.table_name = table_ref_or_name;
    this.fn = fn;
    this._extra_columns = [];
    this._items = undefined;
  }
  _asItems() {
    if (this._items instanceof Array) return this._items;
    const its = [];
    let table;
    if (this.table instanceof Table)  // directly passed a table (most likely via GetTable)
      table = this.table;
    else {
      // Scan existing tables if no reference was passed
      if (typeof(this.table_name)!="string") {
        const tableNames = Object.keys(tables);
        if (tablesAsArray.length) this.table_name = tableNames[0];
        else {
          const chunk_table_name = Object.keys(window.CHUNKS_DICT).find(n=>n.match(/\.[tc]sv$/i));
          if (chunk_table_name==undefined) throw Error("No table found in the project to use with Template");
          this.table_name = chunk_table_name;
        }
      }
      // Get a table instance pointing to table_name
      table = new Table(this.table_name);
    }
    // Set the content of reference if not set yet (eg. just a string was passed or GetTable was used)
    if (!tables[this.table_name]) tables[this.table_name] = window.CHUNKS_DICT[this.table_name];
    // If the content is still empty (no entry in CHUNKS_DICT) throw an error
    if (!tables[this.table_name]) throw Error("No table named "+this.table_name+" found in the project");
    // Initiate the table when calling Template
    table.setAndParseContent(tables[this.table_name]);
    // Prevent any newTrial command in this.fn from pushing items (items already contains Template at right position)
    pushItemsInNewTrial(false);
    const rows = table.rows;
    for (let n in rows) {
      let row = rows[n], item = this.fn(row);
      if (item instanceof Trial){
        item = item._asItem();
        // Add the latin-square tag to the label array if applicable
        if (table._latin){
          const latin_name = table._header.find(v=>v.toLowerCase()==table._latin.toLowerCase());
          if (latin_name) item[0] = [item[0],row[latin_name]];
        }
      }
      // Add template info to every element's options, to be used in the debugger
      const group = table.group;
      for (let i=2; i<item.length; i+=2)
        item[i]._pcibexTable = {name: this.table_name, row: table._rowNumber.get(row), group: group};
      its.push(item);
    }
    pushItemsInNewTrial(true);
    // Store the items for future reference; do not re-run this.fn next time _asItems is called
    this._items = its;
    return its;
  }
  log(name,value) { this._extra_columns.push([name,value]); return this; }
}
export const template = (table_ref_or_name, fn) => {
  if (fn===undefined && table_ref_or_name!==undefined){
    fn = table;
    table_ref_or_name = undefined;
  }
  items.push(new Template(table_ref_or_name,fn));
}
