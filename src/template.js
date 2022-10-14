import { items } from './order'
import { Trial, pushItemsInNewTrial } from './trial'

const tables = [];
const DELIMITERS = [',','\t',';'];
class Table {
  static stripQuotes(text) { return text.replace(/^"([^"]+)"$/,"$1").replace(/^'([^']+)'$/,"$1"); }
  constructor(name){ this.name = name; }
  setContent(content){
    this.content = content;
    this.group_name = 'group';
    this.header = [];
    this.regex = null;
    const lines = content.split(/[\n\r]+/);
    if (lines.length<2) throw Error(`Table ${name} has too few rows (${lines.length}, should be >=2)`);
    // Find the delimiter that outputs the max number of columns
    DELIMITERS.forEach(d=>{
      const rgx = new RegExp(`("[^"]+"|'[^']+'|[^${d}]+)`,'g');
      const cols = lines[0].match(rgx), firstline = lines[1].match(rgx);
      if (lines[0].endsWith(d)) cols.push("");
      if (lines[1].endsWith(d)) firstline.push("");
      if (cols && firstline && cols.length == firstline.length && cols.length > this.header.length){
        this.header = cols.map(c=>Table.stripQuotes(c));
        this.regex = rgx;
      }
    });
    lines.shift();
    this._rows = lines.map( l=>(l.match(this.regex)||[]).map(c=>Table.stripQuotes(c)) );
    this._rows = this._rows.filter( r=>r.length>0 );
    return this;
  }
  _rowAsObject(row) { 
    const o = {};
    this.header.forEach( h=>o[h] = '' );
    row.forEach( (v,i)=>o[this.header[i]] = v ); 
    return o;
  }
  get groups() { 
    const group_n = this.header.findIndex(v=>v.toLowerCase()==this.group_name.toLowerCase());
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
    return this.groups[counter % this.groups.length];
  }
  get rows() {
    const rows = this._rows.map(r=>this._rowAsObject(r));
    if (this.group===undefined) return rows;
    else return rows.filter( r=>r[this.header.find(v=>v.toLowerCase()==this.group_name.toLowerCase())]==this.group );
  }
  setLabel(l) { this.label = l; return this; }
  setGroup(g) { this.group = g; return this; }
  setItem(i) { this.item = i; return this; }
  setList(l) { this.group = l; return this; }
  setLatin(l) { this.latin = l; return this; }
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
  }
  _asItems() {
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
    }
    if (table===undefined) return its;
    // Prevent any newTrial command in this.fn from pushing items (items already contains Template at right position)
    pushItemsInNewTrial(false);
    table.rows.forEach( row => {
      let item = this.fn(row);
      if (item instanceof Trial){
        item = item._asItem();
        if (table.latin){
          const latin_name = table.header.find(v=>v.toLowerCase()==table.latin.toLowerCase());
          if (latin_name)
          its[0] = [its[0],row[latin_name]];
        }
      }
      its.push(item);
    });
    pushItemsInNewTrial(true);
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
