# 🔍 MISSION CONFIRMATION FLOW AUDIT — ROOT CAUSE ANALYSIS

**Date:** 2026-07-02  
**Status:** ✅ COMPLETE — Root cause identified, minimal fix provided

---

## 📋 EXECUTIVE SUMMARY

**Root Cause:** The confirm button (`onclick="confirmBonus()"`) in the HTML is wired to a **globally-scoped function** that no longer exists in the current modular JS. The modern code exports `confirmBonus` from `js/missions.js`, but the HTML is trying to call a non-existent global function.

**The Minimal Fix:** Wire the button click via event listener instead of inline `onclick`.

---

## ✅ VERIFICATION CHECKLIST

### 1. **setMissionStatus receives ONLY mission.id**

**Status:** ✅ **PASS**

- **Definition:** `js/missions.js:28–78`
  ```javascript
  export function setMissionStatus(missionId, val) {
    const m = getMissionById(missionId);
    if (!m) return;
    // ... rest of function uses missionId (never index)
  }
  ```
- **Call sites in render.js:233 & 237:**
  ```javascript
  .addEventListener('click', () => setMissionStatus(mission.id, 'done'));
  .addEventListener('click', () => setMissionStatus(mission.id, 'fail'));
  ```
- ✅ Correctly passes `mission.id` (not index).

---

### 2. **openBonusPopup and confirmBonus use the same missionId consistently**

**Status:** ✅ **PASS**

- **openBonusPopup** (missions.js:83–88):
  ```javascript
  export function openBonusPopup(missionId) {
    state.bonusPending = missionId;  // ← Store missionId
    state.bonusChecks = { capricho: false, pontual: false, semreclamar: false };
    renderBonusPopup(missionId);
    document.getElementById('bonus-overlay').style.display = 'flex';
  }
  ```

- **confirmBonus** (missions.js:117–154):
  ```javascript
  export function confirmBonus() {
    const missionId = state.bonusPending;  // ← Retrieve stored missionId
    if (missionId === null || missionId === undefined) return;
    const m = getMissionById(missionId);
    if (!m) return;
    // ... rest uses missionId consistently
  }
  ```

- ✅ Both functions use `state.bonusPending` to pass the **same missionId**.
- ✅ No index fallback or mismatch.

---

### 3. **state.bonusPending is always a valid missionId**

**Status:** ✅ **PASS**

- **State definition** (state.js:149):
  ```javascript
  bonusPending: null,  // missionIdx aguardando confirmação do popup de bônus
  ```
  Comment says "idx" but is actually storing **missionId** (verified below).

- **Set by openBonusPopup** (missions.js:84):
  ```javascript
  state.bonusPending = missionId;
  ```
  ✅ Stores a valid `missionId` parameter.

- **Retrieved by confirmBonus** (missions.js:118):
  ```javascript
  const missionId = state.bonusPending;
  if (missionId === null || missionId === undefined) return;
  const m = getMissionById(missionId);
  if (!m) return;  // ← Safety check: if mission not found, abort silently
  ```
  ✅ Validates before use.

- **Cleared after confirmation** (missions.js:141):
  ```javascript
  state.bonusPending = null;
  ```
  ✅ Properly reset.

---

### 4. **No mission exists without an id in state.config.missions or getTodayMissions()**

**Status:** ✅ **PASS** (with ID Guarantor in place)

- **ensureMissionIds()** (state.js:94–110):
  ```javascript
  export function ensureMissionIds(missions) {
    if (!missions || !Array.isArray(missions)) {
      return missions;
    }
    
    return missions.map(mission => {
      if (!mission.id || typeof mission.id !== 'string' || mission.id.trim() === '') {
        // Mission missing or has invalid ID: assign a stable unique one
        return {
          ...mission,
          id: generateMissionId()
        };
      }
      // Mission already has a valid ID: keep it (stable across reloads)
      return mission;
    });
  }
  ```

- **Applied at initialization** (state.js:156):
  ```javascript
  state.config.missions = ensureMissionIdsInAllDays(state.config.missions);
  ```

- **Applied on getTodayMissions()** (state.js:158–164):
  ```javascript
  export function getTodayMissions() {
    const dow = new Date().getDay();
    const dayMs = state.config.missions[dow];
    const missions = dayMs ? dayMs.map(m => ({ ...m })) : DEFAULT_MISSIONS_TEMPLATE.map(m => ({ ...m }));
    // Guarantee IDs on today's missions
    return ensureMissionIds(missions);
  }
  ```

- ✅ Every mission is guaranteed to have a valid `.id`.

---

### 5. **No remaining usage of array index for missionStatus access**

**Status:** ✅ **PASS**

- **All accesses use mission.id:**
  - render.js:120–122: `state.missionStatus[mission.id]` ✅
  - render.js:170: `state.missionStatus[mission.id]` ✅
  - render.js:262–264: `state.missionStatus[mission.id]` ✅
  - render.js:321–324: `state.missionStatus[mission.id]` ✅
  - render.js:588–591: `state.missionStatus[mission.id]` ✅
  - missions.js:32: `state.missionStatus[missionId]` ✅
  - missions.js:54: `state.missionStatus[missionId]` ✅
  - missions.js:74: `state.missionStatus[missionId]` ✅
  - missions.js:125: `state.missionStatus[missionId]` ✅
  - missions.js:146–147: `state.missionStatus[k]` where `k` is from `Object.keys()` ✅

- ✅ Zero instances of `state.missionStatus[index]` or `missionStatus[i]`.

---

## 🎯 ROOT CAUSE: THE BROKEN CONFIRM BUTTON

### Location
**File:** `index.html` (the main HTML file)
**Element:** The bonus confirm button

### The Problem

**In the HTML:**
```html
<button class="btn-bonus-confirm" onclick="confirmBonus()">✅ CONFIRMAR!</button>
```

**In js/missions.js:**
```javascript
export function confirmBonus() {
  // Function properly exported from ES module
}
```

**The Issue:**
1. The function `confirmBonus` is **exported** from the ES module `js/missions.js`
2. The HTML still uses inline `onclick="confirmBonus()"`, expecting a **global function**
3. Modern ES modules don't pollute the global scope
4. **Result:** `onclick="confirmBonus()"` tries to call a non-existent global function → **Nothing happens**

### Evidence

**Compare render.js working correctly:**
```javascript
card
  .querySelector('.btn-done')
  .addEventListener('click', () => setMissionStatus(mission.id, 'done'));  // ✅ Works
```

vs **the broken HTML:**
```html
<button class="btn-bonus-confirm" onclick="confirmBonus()">✅ CONFIRMAR!</button>  <!-- ❌ Fails -->
```

---

## 🔧 THE MINIMAL FIX

### Option 1: Wire via Event Listener (Recommended)

**File:** `js/render.js`

Add to the imports:
```javascript
import { confirmBonus } from './missions.js';
```

Add this function to render.js:
```javascript
export function initBonusButtonListener() {
  const confirmBtn = document.getElementById('bonus-confirm-btn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', confirmBonus);
  }
}
```

**File:** `index.html`

Replace:
```html
<button class="btn-bonus-confirm" onclick="confirmBonus()">✅ CONFIRMAR!</button>
```

With:
```html
<button class="btn-bonus-confirm" id="bonus-confirm-btn">✅ CONFIRMAR!</button>
```

**File:** `js/main.js` (or wherever app initialization happens)

Add:
```javascript
initBonusButtonListener();
```

---

### Option 2: Quick Hotfix (if Option 1 not feasible)

**File:** `index.html`

Replace inline `onclick` with:
```html
<button class="btn-bonus-confirm" id="btn-bonus-confirm">✅ CONFIRMAR!</button>
```

**Add at the end of index.html (before closing body):**
```html
<script type="module">
  import { confirmBonus } from './js/missions.js';
  document.getElementById('btn-bonus-confirm').addEventListener('click', confirmBonus);
</script>
```

---

## 🚨 CONSOLE.ERROR WARNINGS TO ADD

### In missions.js:setMissionStatus()

```javascript
export function setMissionStatus(missionId, val) {
  const m = getMissionById(missionId);
  
  if (!m) {
    console.error(
      `[MISSION FLOW] ❌ setMissionStatus called with invalid missionId: "${missionId}" ` +
      `(not found in state.missions). Available IDs: ${state.missions.map(m => m.id).join(', ')}`
    );
    return;
  }
  
  // ... rest of function
}
```

### In missions.js:renderBonusPopup()

```javascript
export function renderBonusPopup(missionId) {
  const m = getMissionById(missionId);
  if (!m) {
    console.error(
      `[MISSION FLOW] ❌ renderBonusPopup called with invalid missionId: "${missionId}". ` +
      `Available: ${state.missions.map(m => m.id).join(', ')}`
    );
    return;
  }
  // ... rest
}
```

### In state.js:getTodayMissions()

```javascript
export function getTodayMissions() {
  const dow = new Date().getDay();
  const dayMs = state.config.missions[dow];
  const missions = dayMs ? dayMs.map(m => ({ ...m })) : DEFAULT_MISSIONS_TEMPLATE.map(m => ({ ...m }));
  const withIds = ensureMissionIds(missions);
  
  // Verify no mission is missing an id
  const badMissions = withIds.filter(m => !m.id);
  if (badMissions.length > 0) {
    console.error(`[MISSION FLOW] ❌ Found ${badMissions.length} mission(s) without id:`, badMissions);
  }
  
  return withIds;
}
```

---

## ✅ SUMMARY TABLE

| Check | Status | Evidence |
|-------|--------|----------|
| `setMissionStatus` receives ONLY `mission.id` | ✅ PASS | missions.js:28, render.js:233, 237 |
| `openBonusPopup` and `confirmBonus` use same `missionId` | ✅ PASS | Both use `state.bonusPending` (missions.js:84, 118) |
| `state.bonusPending` is always valid | ✅ PASS | Validated in confirmBonus (missions.js:120–121) |
| No mission without id in state | ✅ PASS | ensureMissionIds() guarantor (state.js:94–110) |
| No array index fallback for missionStatus | ✅ PASS | All accesses use `.id` (10/10 locations) |
| **Confirm button works** | ❌ FAIL | Missing event listener wiring (see root cause above) |

---

## 📌 CONCLUSION

**The mission flow itself is architecturally sound.**

The **only** problem is the **HTML-to-JS wiring of the confirm button**. The button's `onclick="confirmBonus()"` is trying to call a global function that doesn't exist in the ES module context.

**Fix:** Replace inline `onclick` with an event listener (via `addEventListener`), exactly like the mission done/fail buttons already do in render.js.

This is a **1-line fix** in HTML + **1-2 lines** of JS to wire the listener.
