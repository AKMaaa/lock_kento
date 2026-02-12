// ========== ログ機能 ==========
let logData = [];
function addLog(entry) {
    logData.push(entry);
    renderLogTable();
    saveState();
}
function renderLogTable() {
    const body = document.getElementById('logTableBody');
    body.innerHTML = logData.map(log => `<tr><td>${log.time}</td><td>${log.category}</td><td>${log.action}</td><td>${log.value}</td><td>${log.attempts !== undefined ? log.attempts : ''}</td><td>${log.result}</td></tr>`).join('');
}
function clearLog() {
    if (!window.confirm('本当にログを消去しますか？')) {
        return;
    }
    logData = [];
    renderLogTable();
    saveState();
}
function downloadCSV() {
    if(logData.length === 0) return;
    const header = ['時刻','種別','動作','値','挑戦回数','判定'];
    const rows = logData.map(e=>[e.time,e.category,e.action,e.value,e.attempts !== undefined ? e.attempts : '',e.result]);
    let csv = header.join(',') + '\n';
    csv += rows.map(r=>r.map(x=>(typeof x==='string'?x.replace(/"/g,'""'):'')).map(x=>`"${x}"`).join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'lock_log.csv'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 200);
}
function toggleLogView() {
    const logWrap = document.getElementById('logWrap');
    if (logWrap.style.display === 'none') {
        logWrap.style.display = 'block';
        renderLogTable();
    } else {
        logWrap.style.display = 'none';
    }
    saveState();
}
// ========== 状態の保存と復元 ==========
function saveState() {
    const state = {
        currentMode: currentMode,
        pinSavedPin: pinSavedPin,
        pinAttempts: pinAttempts,
        patternSavedPattern: patternSavedPattern,
        patternAttempts: patternAttempts,
        logData: logData,
        logWrapVisible: document.getElementById('logWrap').style.display !== 'none'
    };
    localStorage.setItem('lockAppState', JSON.stringify(state));
}

function loadState() {
    const saved = localStorage.getItem('lockAppState');
    if (!saved) return;
    
    try {
        const state = JSON.parse(saved);
        
        // ログデータを復元
        if (state.logData) {
            logData = state.logData;
            renderLogTable();
        }
        
        // ログ表示状態を復元
        if (state.logWrapVisible) {
            document.getElementById('logWrap').style.display = 'block';
        }
        
        // PINロックの状態を復元
        if (state.pinSavedPin) {
            pinSavedPin = state.pinSavedPin;
        }
        if (state.pinAttempts !== undefined) {
            pinAttempts = state.pinAttempts;
        }
        
        // パターンロックの状態を復元
        if (state.patternSavedPattern) {
            patternSavedPattern = state.patternSavedPattern;
        }
        if (state.patternAttempts !== undefined) {
            patternAttempts = state.patternAttempts;
        }
        
        // モードを復元
        if (state.currentMode) {
            currentMode = state.currentMode;
            selectMode(state.currentMode);
        }
    } catch (e) {
        console.error('Failed to load state:', e);
    }
}

window.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('clearLogBtn').onclick = clearLog;
    document.getElementById('dlLogBtn').onclick = downloadCSV;
    
    // 状態を復元
    loadState();
});

// モード管理
let currentMode = null;

function selectMode(mode) {
    currentMode = mode;
    document.getElementById('modeSelection').style.display = 'none';
    
    if (mode === 'pin') {
        document.getElementById('pinLockView').classList.add('active');
        initPinDisplay();
        updatePinAttemptsDisplay();
        // 保存されたPINがある場合は、ステータスを更新
        if (pinSavedPin) {
            pinStatus.textContent = 'PINコードを入力してください';
            pinStatus.className = 'status info';
        }
    } else if (mode === 'pattern') {
        document.getElementById('patternLockView').classList.add('active');
        // patternDotsが初期化されていない場合のみ初期化
        if (!patternDots) {
            initPatternLock();
        } else {
            // 既に初期化されている場合は、表示だけ更新
            clearPattern();
            updatePatternAttemptsDisplay();
        }
        // 保存されたパターンがある場合は、ステータスを更新
        if (patternSavedPattern) {
            patternStatus.textContent = 'パターンを描いてください';
            patternStatus.className = 'status info';
        }
    }
    saveState();
}

function backToSelection() {
    const previousMode = currentMode;
    currentMode = null;
    document.getElementById('modeSelection').style.display = 'block';
    document.getElementById('pinLockView').classList.remove('active');
    document.getElementById('patternLockView').classList.remove('active');
    
    // ログ表示を非表示にする
    document.getElementById('logWrap').style.display = 'none';
    
    // PINロックの入力中の状態だけをクリア（保存されたPINと挑戦回数は保持）
    if (previousMode === 'pin') {
        currentPin = [];
        if (pinDisplay) {
            updatePinDisplay();
        }
    }
    
    // パターンロックの入力中の状態だけをクリア（保存されたパターンと挑戦回数は保持）
    if (previousMode === 'pattern') {
        currentPattern = [];
        lastDot = null;
        isDrawing = false;
        if (patternDots) {
            patternDots.forEach(dot => {
                dot.classList.remove('active', 'visited', 'error', 'success');
            });
        }
        if (lines) {
            lines.forEach(line => line.remove());
            lines = [];
        }
    }
}

// ========== PINロック機能 ==========
let currentPin = [];
let pinSavedPin = null;
let pinLength = 4;
let pinAttempts = 0;

const pinStatus = document.getElementById('pinStatus');
const pinDisplay = document.getElementById('pinDisplay');
const container = document.getElementById('container');
const pinAttemptsDisplay = document.getElementById('pinAttemptsDisplay');

function updatePinAttemptsDisplay() {
    pinAttemptsDisplay.textContent = `挑戦回数: ${pinAttempts}`;
}

function initPinDisplay() {
    pinDisplay.innerHTML = '';
    for (let i = 0; i < pinLength; i++) {
        const dot = document.createElement('div');
        dot.className = 'pin-dot';
        pinDisplay.appendChild(dot);
    }
    updatePinDisplay();
}

function updatePinDisplay() {
    const dots = pinDisplay.querySelectorAll('.pin-dot');
    dots.forEach((dot, index) => {
        dot.classList.remove('filled', 'error', 'success');
        if (index < currentPin.length) {
            dot.classList.add('filled');
        }
    });
}

function changePinLength() {
    const select = document.getElementById('pinLength');
    pinLength = parseInt(select.value);
    currentPin = [];
    initPinDisplay();
    if (!pinSavedPin) {
        pinStatus.textContent = 'まずPINコードを設定してください';
        pinStatus.className = 'status info';
    } else {
        pinStatus.textContent = 'PINコードを入力してください';
        pinStatus.className = 'status info';
    }
}

function inputNumber(num) {
    if (currentMode !== 'pin') return;
    if (currentPin.length >= pinLength) {
        return;
    }

    currentPin.push(num);
    updatePinDisplay();

    if (!pinSavedPin) {
        pinStatus.textContent = `PINコードを入力中... (${currentPin.length}/${pinLength})`;
        pinStatus.className = 'status info';
    } else {
        pinStatus.textContent = `PINコードを入力中... (${currentPin.length}/${pinLength})`;
        pinStatus.className = 'status info';
        
        if (currentPin.length === pinLength) {
            pinAttempts++;
            updatePinAttemptsDisplay();
            saveState();
            setTimeout(() => {
                if (validatePin()) {
                    showPinSuccess();
                } else {
                    showPinError();
                }
            }, 300);
        }
    }
}

function deleteLastPin() {
    if (currentMode !== 'pin') return;
    if (currentPin.length > 0) {
        currentPin.pop();
        updatePinDisplay();
        if (!pinSavedPin) {
            pinStatus.textContent = currentPin.length > 0 
                ? `PINコードを入力中... (${currentPin.length}/${pinLength})`
                : 'まずPINコードを設定してください';
        } else {
            pinStatus.textContent = currentPin.length > 0 
                ? `PINコードを入力中... (${currentPin.length}/${pinLength})`
                : 'PINコードを入力してください';
        }
        pinStatus.className = 'status info';
    }
}

function clearPinInput() {
    if (currentMode !== 'pin') return;
    currentPin = [];
    updatePinDisplay();
    if (!pinSavedPin) {
        pinStatus.textContent = 'まずPINコードを設定してください';
    } else {
        pinStatus.textContent = 'PINコードを入力してください';
    }
    pinStatus.className = 'status info';
}

function setPin() {
    if (currentMode !== 'pin') return;
    if (currentPin.length !== pinLength) {
        pinStatus.textContent = `${pinLength}桁のPINコードを入力してください`;
        pinStatus.className = 'status error';
        return;
    }
    addLog({
        time: new Date().toLocaleString(),
        category: 'PIN',
        action: '設定',
        value: currentPin.join(''),
        attempts: '',
        result: ''
    });
    pinSavedPin = [...currentPin];
    pinAttempts = 0;
    updatePinAttemptsDisplay();
    pinStatus.textContent = 'PINコードが設定されました！解除を試してください';
    pinStatus.className = 'status success';
    clearPinInput();
    saveState();
}

function resetPin() {
    if (currentMode !== 'pin') return;
    pinSavedPin = null;
    pinAttempts = 0;
    updatePinAttemptsDisplay();
    clearPinInput();
    pinStatus.textContent = 'PINコードを設定してください';
    pinStatus.className = 'status info';
    saveState();
}

function validatePin() {
    if (!pinSavedPin) {
        pinStatus.textContent = 'まずPINコードを設定してください';
        pinStatus.className = 'status error';
        return false;
    }

    if (currentPin.length !== pinSavedPin.length) {
        return false;
    }

    for (let i = 0; i < currentPin.length; i++) {
        if (currentPin[i] !== pinSavedPin[i]) {
            return false;
        }
    }

    return true;
}

function showPinError() {
    addLog({
        time: new Date().toLocaleString(),
        category: 'PIN',
        action: '入力',
        value: currentPin.join(''),
        attempts: pinAttempts,
        result: '不正解'
    });
    pinStatus.textContent = 'PINコードが一致しません';
    pinStatus.className = 'status error';
    container.classList.add('error-shake');
    
    const dots = pinDisplay.querySelectorAll('.pin-dot');
    dots.forEach(dot => {
        dot.classList.remove('filled', 'success');
        dot.classList.add('error');
    });

    setTimeout(() => {
        container.classList.remove('error-shake');
        clearPinInput();
    }, 500);
}

function showPinSuccess() {
    addLog({
        time: new Date().toLocaleString(),
        category: 'PIN',
        action: '入力',
        value: currentPin.join(''),
        attempts: pinAttempts,
        result: '正解'
    });
    pinStatus.textContent = '解除成功！';
    pinStatus.className = 'status success';
    container.classList.add('success-glow');
    
    const dots = pinDisplay.querySelectorAll('.pin-dot');
    dots.forEach((dot, index) => {
        setTimeout(() => {
            dot.classList.remove('filled', 'error');
            dot.classList.add('success');
        }, index * 50);
    });

    setTimeout(() => {
        container.classList.remove('success-glow');
        clearPinInput();
        pinStatus.textContent = 'PINコードを入力してください';
        pinStatus.className = 'status info';
    }, 2000);
}

// ========== パターンロック機能 ==========
const patternGrid = document.getElementById('patternGrid');
const patternStatus = document.getElementById('patternStatus');
const patternAttemptsDisplay = document.getElementById('patternAttemptsDisplay');
let patternDots = null;

let currentPattern = [];
let patternSavedPattern = null;
let patternAttempts = 0;
let isDrawing = false;
let lastDot = null;
let lines = [];

function updatePatternAttemptsDisplay() {
    patternAttemptsDisplay.textContent = `挑戦回数: ${patternAttempts}`;
}

function initPatternLock() {
    patternDots = document.querySelectorAll('#patternGrid .dot');
    currentPattern = [];
    // patternSavedPatternは保持する（戻るボタンでリセットされないように）
    isDrawing = false;
    lastDot = null;
    lines = [];
    clearPattern();
    updatePatternAttemptsDisplay();
}

function getDotPosition(index) {
    const dot = patternDots[index];
    const rect = patternGrid.getBoundingClientRect();
    const dotRect = dot.getBoundingClientRect();
    return {
        x: dotRect.left + dotRect.width / 2 - rect.left,
        y: dotRect.top + dotRect.height / 2 - rect.top
    };
}

function getDistance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function getDotIndexFromPosition(x, y) {
    const rect = patternGrid.getBoundingClientRect();
    const localX = x - rect.left;
    const localY = y - rect.top;

    let closestIndex = -1;
    let closestDistance = 60;

    for (let i = 0; i < patternDots.length; i++) {
        const pos = getDotPosition(i);
        const distance = getDistance(localX, localY, pos.x, pos.y);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = i;
        }
    }
    return closestIndex;
}

function checkIntermediateDot(fromIndex, toIndex) {
    if (fromIndex === -1 || toIndex === -1) return -1;
    
    const fromRow = Math.floor(fromIndex / 3);
    const fromCol = fromIndex % 3;
    const toRow = Math.floor(toIndex / 3);
    const toCol = toIndex % 3;
    
    if (fromRow === toRow && Math.abs(fromCol - toCol) === 2) {
        return fromRow * 3 + 1;
    } else if (fromCol === toCol && Math.abs(fromRow - toRow) === 2) {
        return 3 + fromCol;
    } else if (Math.abs(fromRow - toRow) === 2 && Math.abs(fromCol - toCol) === 2) {
        return 4;
    }
    
    return -1;
}

function drawLine(fromIndex, toIndex, lineClass = '') {
    const from = getDotPosition(fromIndex);
    const to = getDotPosition(toIndex);
    
    const length = getDistance(from.x, from.y, to.x, to.y);
    const angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
    
    const line = document.createElement('div');
    line.className = 'line' + (lineClass ? ' ' + lineClass : '');
    line.style.width = length + 'px';
    line.style.left = from.x + 'px';
    line.style.top = from.y + 'px';
    line.style.transform = `rotate(${angle}deg)`;
    
    patternGrid.appendChild(line);
    lines.push(line);
}

function activateDot(index) {
    if (index === -1) return;
    if (currentPattern.includes(index)) return;
    
    if (lastDot !== null && lastDot !== index) {
        const intermediate = checkIntermediateDot(lastDot, index);
        if (intermediate !== -1 && !currentPattern.includes(intermediate)) {
            activateDotDirect(intermediate);
        }
    }
    
    activateDotDirect(index);
}

function activateDotDirect(index) {
    if (currentPattern.includes(index)) return;
    
    const dot = patternDots[index];
    dot.classList.add('active');
    
    if (lastDot !== null && lastDot !== index) {
        drawLine(lastDot, index);
    }
    
    currentPattern.push(index);
    lastDot = index;
    
    setTimeout(() => {
        dot.classList.remove('active');
        dot.classList.add('visited');
    }, 200);
}

function clearPattern() {
    if (currentMode !== 'pattern') return;
    currentPattern = [];
    lastDot = null;
    isDrawing = false;
    
    if (patternDots) {
        patternDots.forEach(dot => {
            dot.classList.remove('active', 'visited', 'error', 'success');
        });
    }
    
    lines.forEach(line => line.remove());
    lines = [];
    
    patternStatus.textContent = patternSavedPattern ? 'パターンを描いてください' : 'まずパターンを描いて「パターン設定」を押してください';
    patternStatus.className = 'status info';
}

function setPattern() {
    addLog({
        time: new Date().toLocaleString(),
        category: 'パターン',
        action: '設定',
        value: currentPattern.map(i => i+1).join('-'),
        attempts: '',
        result: ''
    });
    if (currentMode !== 'pattern') return;
    if (currentPattern.length < 3) {
        patternStatus.textContent = '最低3つの点を結んでください';
        patternStatus.className = 'status error';
        return;
    }
    
    patternSavedPattern = [...currentPattern];
    patternAttempts = 0;
    updatePatternAttemptsDisplay();
    patternStatus.textContent = 'パターンが設定されました！解除を試してください';
    patternStatus.className = 'status success';
    clearPattern();
    saveState();
}

function resetPattern() {
    if (currentMode !== 'pattern') return;
    patternSavedPattern = null;
    patternAttempts = 0;
    updatePatternAttemptsDisplay();
    clearPattern();
    patternStatus.textContent = 'パターンを設定してください';
    patternStatus.className = 'status info';
    saveState();
}

function validatePattern() {
    if (!patternSavedPattern) {
        patternStatus.textContent = 'まずパターンを設定してください';
        patternStatus.className = 'status error';
        return false;
    }
    
    if (currentPattern.length !== patternSavedPattern.length) {
        return false;
    }
    
    for (let i = 0; i < currentPattern.length; i++) {
        if (currentPattern[i] !== patternSavedPattern[i]) {
            return false;
        }
    }
    
    return true;
}

// パターンロックのイベントリスナー
function setupPatternEvents() {
    patternGrid.addEventListener('mousedown', (e) => {
        if (currentMode !== 'pattern') return;
        isDrawing = true;
        const index = getDotIndexFromPosition(e.clientX, e.clientY);
        if (index !== -1) {
            activateDot(index);
            if (!patternSavedPattern) {
                patternStatus.textContent = `パターンを描いています... (${currentPattern.length}点)`;
                patternStatus.className = 'status info';
            }
        }
    });

    patternGrid.addEventListener('mousemove', (e) => {
        if (currentMode !== 'pattern' || !isDrawing) return;
        
        const index = getDotIndexFromPosition(e.clientX, e.clientY);
        if (index !== -1 && index !== lastDot) {
            activateDot(index);
            if (!patternSavedPattern) {
                patternStatus.textContent = `パターンを描いています... (${currentPattern.length}点)`;
                patternStatus.className = 'status info';
            }
        }
    });

    patternGrid.addEventListener('mouseup', () => {
        if (currentMode !== 'pattern' || !isDrawing) return;
        
        isDrawing = false;
        
        if (!patternSavedPattern) {
            if (currentPattern.length < 3) {
                patternStatus.textContent = '最低3つの点を結んでください';
                patternStatus.className = 'status error';
                setTimeout(() => {
                    clearPattern();
                    patternStatus.textContent = 'パターンを描いてください';
                    patternStatus.className = 'status info';
                }, 2000);
            } else {
                patternStatus.textContent = `${currentPattern.length}点のパターンが描かれました。「パターン設定」ボタンを押して保存してください`;
                patternStatus.className = 'status info';
            }
        } else {
            if (currentPattern.length < 3) {
                patternStatus.textContent = '最低3つの点を結んでください';
                patternStatus.className = 'status error';
                clearPattern();
                return;
            }
            
            patternAttempts++;
            updatePatternAttemptsDisplay();
            saveState();

            if (validatePattern()) {
                addLog({
                    time: new Date().toLocaleString(),
                    category: 'パターン',
                    action: '入力',
                    value: currentPattern.map(i => i+1).join('-'),
                    attempts: patternAttempts,
                    result: '正解'
                });
                patternStatus.textContent = '解除成功！';
                patternStatus.className = 'status success';
                const patternContainer = document.querySelector('.pattern-container');
                patternContainer.classList.add('success-glow');
                
                // 成功時の視覚的フィードバック
                patternDots.forEach((dot, index) => {
                    if (currentPattern.includes(index)) {
                        setTimeout(() => {
                            dot.classList.remove('visited', 'error');
                            dot.classList.add('success');
                        }, index * 50);
                    }
                });
                
                // 線を成功色に変更
                lines.forEach((line, index) => {
                    setTimeout(() => {
                        line.classList.remove('error');
                        line.classList.add('success');
                    }, index * 50);
                });
                
                setTimeout(() => {
                    patternContainer.classList.remove('success-glow');
                    clearPattern();
                    patternStatus.textContent = 'パターンを描いてください';
                    patternStatus.className = 'status info';
                }, 2000);
            } else {
                addLog({
                    time: new Date().toLocaleString(),
                    category: 'パターン',
                    action: '入力',
                    value: currentPattern.map(i => i+1).join('-'),
                    attempts: patternAttempts,
                    result: '不正解'
                });
                patternStatus.textContent = 'パターンが一致しません';
                patternStatus.className = 'status error';
                const patternContainer = document.querySelector('.pattern-container');
                patternContainer.classList.add('error-shake');
                
                // 失敗時の視覚的フィードバック
                patternDots.forEach((dot, index) => {
                    if (currentPattern.includes(index)) {
                        dot.classList.remove('visited', 'success');
                        dot.classList.add('error');
                    }
                });
                
                // 線をエラー色に変更
                lines.forEach(line => {
                    line.classList.remove('success');
                    line.classList.add('error');
                });
                
                setTimeout(() => {
                    patternContainer.classList.remove('error-shake');
                    clearPattern();
                }, 500);
            }
        }
    });

    // タッチイベント
    patternGrid.addEventListener('touchstart', (e) => {
        if (currentMode !== 'pattern') return;
        e.preventDefault();
        isDrawing = true;
        const touch = e.touches[0];
        const index = getDotIndexFromPosition(touch.clientX, touch.clientY);
        if (index !== -1) {
            activateDot(index);
            if (!patternSavedPattern) {
                patternStatus.textContent = `パターンを描いています... (${currentPattern.length}点)`;
                patternStatus.className = 'status info';
            }
        }
    });

    patternGrid.addEventListener('touchmove', (e) => {
        if (currentMode !== 'pattern' || !isDrawing) return;
        e.preventDefault();
        
        const touch = e.touches[0];
        const index = getDotIndexFromPosition(touch.clientX, touch.clientY);
        if (index !== -1 && index !== lastDot) {
            activateDot(index);
            if (!patternSavedPattern) {
                patternStatus.textContent = `パターンを描いています... (${currentPattern.length}点)`;
                patternStatus.className = 'status info';
            }
        }
    });

    patternGrid.addEventListener('touchend', (e) => {
        if (currentMode !== 'pattern' || !isDrawing) return;
        e.preventDefault();
        
        isDrawing = false;
        
        if (!patternSavedPattern) {
            if (currentPattern.length < 3) {
                patternStatus.textContent = '最低3つの点を結んでください';
                patternStatus.className = 'status error';
                setTimeout(() => {
                    clearPattern();
                    patternStatus.textContent = 'パターンを描いてください';
                    patternStatus.className = 'status info';
                }, 2000);
            } else {
                patternStatus.textContent = `${currentPattern.length}点のパターンが描かれました。「パターン設定」ボタンを押して保存してください`;
                patternStatus.className = 'status info';
            }
        } else {
            if (currentPattern.length < 3) {
                patternStatus.textContent = '最低3つの点を結んでください';
                patternStatus.className = 'status error';
                clearPattern();
                return;
            }
            
            patternAttempts++;
            updatePatternAttemptsDisplay();
            saveState();

            if (validatePattern()) {
                addLog({
                    time: new Date().toLocaleString(),
                    category: 'パターン',
                    action: '入力',
                    value: currentPattern.map(i => i+1).join('-'),
                    attempts: patternAttempts,
                    result: '正解'
                });
                patternStatus.textContent = '解除成功！';
                patternStatus.className = 'status success';
                const patternContainer = document.querySelector('.pattern-container');
                patternContainer.classList.add('success-glow');
                
                // 成功時の視覚的フィードバック
                patternDots.forEach((dot, index) => {
                    if (currentPattern.includes(index)) {
                        setTimeout(() => {
                            dot.classList.remove('visited', 'error');
                            dot.classList.add('success');
                        }, index * 50);
                    }
                });
                
                // 線を成功色に変更
                lines.forEach((line, index) => {
                    setTimeout(() => {
                        line.classList.remove('error');
                        line.classList.add('success');
                    }, index * 50);
                });
                
                setTimeout(() => {
                    patternContainer.classList.remove('success-glow');
                    clearPattern();
                    patternStatus.textContent = 'パターンを描いてください';
                    patternStatus.className = 'status info';
                }, 2000);
            } else {
                addLog({
                    time: new Date().toLocaleString(),
                    category: 'パターン',
                    action: '入力',
                    value: currentPattern.map(i => i+1).join('-'),
                    attempts: patternAttempts,
                    result: '不正解'
                });
                patternStatus.textContent = 'パターンが一致しません';
                patternStatus.className = 'status error';
                const patternContainer = document.querySelector('.pattern-container');
                patternContainer.classList.add('error-shake');
                
                // 失敗時の視覚的フィードバック
                patternDots.forEach((dot, index) => {
                    if (currentPattern.includes(index)) {
                        dot.classList.remove('visited', 'success');
                        dot.classList.add('error');
                    }
                });
                
                // 線をエラー色に変更
                lines.forEach(line => {
                    line.classList.remove('success');
                    line.classList.add('error');
                });
                
                setTimeout(() => {
                    patternContainer.classList.remove('error-shake');
                    clearPattern();
                }, 500);
            }
        }
    });
}

// キーボード入力対応（PINロック用）
document.addEventListener('keydown', (e) => {
    if (currentMode !== 'pin') return;
    
    if (e.key >= '0' && e.key <= '9') {
        inputNumber(parseInt(e.key));
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
        deleteLastPin();
    } else if (e.key === 'Escape') {
        clearPinInput();
    } else if (e.key === 'Enter') {
        if (!pinSavedPin) {
            setPin();
        } else if (currentPin.length === pinLength) {
            if (validatePin()) {
                showPinSuccess();
            } else {
                showPinError();
            }
        }
    }
});

// 初期化
setupPatternEvents();

