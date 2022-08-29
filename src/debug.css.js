import { addStylesheet } from './utils'

export const width = 400, height = 200;
export const left = document.documentElement.clientWidth - width - 10, top = 36;

const HEADER_HEIGHT = '1.5em', TAB_TITLE_HEIGHT = '1em';

addStylesheet(`
.debugger {
  position: absolute;
  width: ${width}px;
  height: ${height}px;
  background-color: floralwhite;
  left: ${left}px;
  top: ${top}px;
  border-radius: 5px;
  z-index: 99998;
  overflow: hidden;
  min-width: 260px;
  min-height: ${HEADER_HEIGHT};
}
.debugger.folded {
  max-height: ${HEADER_HEIGHT};
}
.debugger .resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 1em;
  height: 1em;
  background-color: grey;
  cursor: se-resize;
  z-index: 99999;
  background: rgba(0, 0, 0, 0) repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.5) 2px, rgb(119, 119, 119) 2px, rgb(119, 119, 119) 4px) repeat scroll 0% 0%;
  clip-path: polygon(90% 0px, 90% 90%, 0px 90%);
  opacity: 0.5;
}
.debugger .header {
  line-height: ${HEADER_HEIGHT};
  height: ${HEADER_HEIGHT};
  width: 100%;
  cursor: grab;
  background-color: grey;
  color: white;
  display: flex;
  border-radius: 5px 5px 0px 0px;
}
.debugger .header .arrow {
  padding: 0px 5px 0px 2px;
  cursor: pointer;
}
.debugger .header .cross {
  position: absolute;
  absolute;
  top: 2px;
  right: 5px;
  cursor: pointer;
  font-size: 0.75em;
  height: 1.5em;
  width: 1.5em;
  text-align: center;
  line-height: 1.5em;
}
.debugger .header .cross:hover {
  border: solid 1px white;
  border-radius: 2.5px;
}
.debugger .tabtitles {
  display: flex;
  width: 100%;
  height: calc(${TAB_TITLE_HEIGHT} + 10px);
  line-height: ${TAB_TITLE_HEIGHT};
  overflow: hidden;
}
.debugger.folded .tabtitles {
  display: none;
}
.debugger .tabtitles .title {
  border: 1px solid lightgray;
  border-radius: 5px 5px 0px 0px;
  padding: 5px 5px 4px 5px;
  cursor: pointer;
  color: lightgray;
  z-index: 99999;
  margin-bottom: -1px;
  margin-right: 1px;
}
.debugger .tabtitles .title.active {
  color: black;
  border-bottom: solid 3px floralwhite;
}
.debugger .tab {
  position: absolute;
  height: calc(100% - ${HEADER_HEIGHT} - ${TAB_TITLE_HEIGHT} - 34px);
  width: calc(100% - 22px);
  visibility: hidden;
  font-family: mono;
  padding: 10px;
  margin-top: -1px;
  border: solid 1px lightgray;
}
.debugger .tab.active {
  visibility: visible;
}
.debugger.folded .tab {
  visibility: hidden;
  pointer-events: none;
}
.debugger .tab.Sequence li button {
  position: absolute;
  right: 0.5em;
}
.debugger .tab.Sequence, .debugger .tab.Warnings, .debugger .tab.Errors, .debugger .tab.Logs .messages {
  display: flex;
  flex-direction: column;
  overflow-y: scroll;
}
.debugger .tab.Logs {
  overflow-y: hidden; 
}
.debugger .tab.Logs .buttons {
  height: 1.5em;
  display: flex;
  justify-content: space-evenly;
}
.debugger .tab.Logs .messages {
  font-size: small;
  height: calc(100% - 1.5em);
}
`);
