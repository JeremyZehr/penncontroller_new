import { debug } from './debug'
import { items } from './order'
import { Trial, pushItemsInNewTrial } from './trial'

const tables = [];
const DELIMITERS = [',','\t',';','\\|'];
class Table {
  static strip(text,delimiter) { // process the regexp-delimiter-parsed header and rows
    return (text||"")
              .replace(new RegExp(`^${delimiter}`), '')   // remove delimiter at the start
              .replace(/^"(([^"]|\\")+)"$/, "$1")         // remove double quotes
              .replace(/^'(([^']|\\')+)'$/, "$1");        // remove single quotes
  }
  constructor(name){ this.name = name; }
  setContent(content){
    this._content = content;
    this._group_name = 'group';
    this._header = [];
    this._regex = null;
    const lines = this._content.split(/[\n\r]+/);
    if (lines.length<2) throw Error(`Table ${name} has too few rows (${lines.length}, should be >=2)`);
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
  _rowAsObject(row) { 
    const o = {};
    this._header.forEach( h=>o[h] = '' );
    row.forEach( (v,i)=>o[this._header[i]] = v ); 
    return o;
  }
  get groups() { 
    const group_n = this._header.findIndex(v=>v.toLowerCase()==this._group_name.toLowerCase());
    if (group_n < 0)
      return [];
    else
      return this._rows.map(r=>r[group_n])
                       .reduce( (m,n) => (m instanceof Array ? (m.indexOf(n)<0?[...m,n]:m) : (m==n?[m]:[m,n])) )
                       .sort()
  }
  get group() { 
    let counter = window.__counter_value_from_server__;
    if (window.counterOverride && !isNaN(parseInt(window.counterOverride))) counter = parseInt(window.counterOverride);
    return this._groups[counter % this._groups.length];
  }
  get rows() {
    const rows = this._rows.map(r=>this._rowAsObject(r));
    if (this._group===undefined) return rows;
    else return rows.filter( r=>r[this._header.find(v=>v.toLowerCase()==this._group_name.toLowerCase())]==this._group );
  }
  setLabel(l) { this._label = l; return this; }
  setGroup(g) { this._group = g; return this; }
  setItem(i) { this._item = i; return this; }
  setList(l) { this._group = l; return this; }
  setLatin(l) { this._latin = l; return this; } // TODO
  filter(f) { 
    const filteredTable = new Table(undefined); // Anonymous copy of this.table_name
    filteredTable.setContent(this._content);
    filteredTable._rows = filteredTable._rows.filter(r=>f(this._rowAsObject(r)));
    return filteredTable;
  }
}
export const addTable = (name,content) => tables[tables.push(new Table(name))-1].setContent(content);
export const getTable = name => (tables.find(t=>t.name==name) || tables[tables.push(new Table(name))-1]);

export class Template {
  constructor(table_ref_or_name,fn){
    if (table_ref_or_name instanceof Table)
      this.table = table_ref_or_name;
    else if (typeof table_ref_or_name == "string")
      this.table_name = table_ref_or_name;
    this.fn = fn;
    this._extra_columns = [];
    this._items = undefined;
  }
  _asItems() {
    if (this._items instanceof Array) return this._items;
    const its = [];
    let table;
    if (this.table instanceof Table)
      table = this.table;
    else {
      if (typeof this.table_name != "string"){
        if (tables.length) this.table_name = tables[0].name;
        else {
          const chunk_table_names = Object.keys(window.CHUNKS_DICT[this.table_name]).filter(n=>n.match(/\.[tc]sv$/i));
          if (chunk_table_names.length) this.table_name = chunk_table_names[0];
        }
      }
      table = tables.find(t=>t.name==this.table_name);
      if (table===undefined && window.CHUNKS_DICT[this.table_name])
        table = addTable(this.table_name, window.CHUNKS_DICT[this.table_name]);
      else {
        const errorMessage = "Couldn't find a table named "+this.table_name;
        debug.error(errorMessage);
        throw Error(errorMessage);
      }
    }
    if (table===undefined) return its;
    // Prevent any newTrial command in this.fn from pushing items (items already contains Template at right position)
    pushItemsInNewTrial(false);
    table.rows.forEach( (row,n) => {
      let item = this.fn(row);
      if (item instanceof Trial){
        item = item._asItem();
        if (table._latin){
          const latin_name = table._header.find(v=>v.toLowerCase()==table._latin.toLowerCase());
          if (latin_name) item[0] = [item[0],row[latin_name]];
        }
      }
      // Add template info to every element's options, to be used in the debugger
      item.forEach((c,i)=>(i+1)%3==0?c._pcibexTable={name: this.table_name, row: n}:0);
      its.push(item);
    });
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
