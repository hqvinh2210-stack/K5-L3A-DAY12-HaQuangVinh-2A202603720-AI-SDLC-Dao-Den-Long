export const actionLabels=Object.freeze({
  up:'Đi tới',left:'Sang trái',down:'Đi lùi',right:'Sang phải',jump:'Nhảy',
  dash:'Lướt',interact:'Nạp ánh sáng',pulse:'Tỏa Sáng',pause:'Tạm dừng',
});
export const defaultBindings=Object.freeze({
  up:'KeyW',left:'KeyA',down:'KeyS',right:'KeyD',jump:'Space',dash:'ShiftLeft',
  interact:'KeyE',pulse:'KeyF',pause:'Escape',
});
export const reservedKeys=new Set(['KeyQ','KeyR','Tab']);
const aliases={
  up:'ArrowUp',left:'ArrowLeft',down:'ArrowDown',right:'ArrowRight',dash:'ShiftRight',pause:'KeyP',
};

export const defaultSettings=Object.freeze({volume:60,sensitivity:100,
  colorblind:false,reducedMotion:false,largeText:false,bindings:defaultBindings});

export function keyLabel(code) {
  const labels={Space:'Cách',Escape:'Esc',ShiftLeft:'Shift trái',ShiftRight:'Shift phải',
    ArrowUp:'Mũi tên lên',ArrowDown:'Mũi tên xuống',ArrowLeft:'Mũi tên trái',
    ArrowRight:'Mũi tên phải',ControlLeft:'Ctrl trái',ControlRight:'Ctrl phải',Backspace:'Xóa lùi',Enter:'Enter'};
  return labels[code] ?? code.replace(/^(Key|Digit)/,'');
}

export function bindingConflict(bindings,action,key) {
  return Object.keys(actionLabels).find(other=>other!==action && (bindings[other]===key ||
    (aliases[other]===key && bindings[other]===defaultBindings[other])));
}

export function actionAtKey(bindings,code) {
  const direct=Object.keys(actionLabels).find(key=>bindings[key]===code);
  return direct ?? Object.keys(aliases).find(key=>aliases[key]===code && bindings[key]===defaultBindings[key]);
}

export function parseSettings(raw) {
  const settings={...defaultSettings,bindings:{...defaultBindings}};
  try {
    const value=JSON.parse(raw??'null');
    if (!value || typeof value!=='object') return settings;
    for (const [key,min,max] of [['volume',0,100],['sensitivity',25,200]]) {
      if (Number.isFinite(value[key])) settings[key]=Math.max(min,Math.min(max,value[key]));
    }
    for (const key of ['colorblind','largeText','reducedMotion']) settings[key]=value[key]===true;
    const keys=Object.keys(actionLabels);
    const candidate=Object.fromEntries(keys.map(action=>[action,value.bindings?.[action]??defaultBindings[action]]));
    if (keys.every(action=>typeof candidate[action]==='string' && /^[A-Za-z][A-Za-z0-9]*$/.test(candidate[action]) &&
        !reservedKeys.has(candidate[action]) && !bindingConflict(candidate,action,candidate[action]))) settings.bindings=candidate;
  } catch { /* Reset invalid preferences. */ }
  return settings;
}
