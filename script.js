/**
 * Lotto Pro Generator - Logic Script
 * Implements 7 advanced statistical filters to generate optimal numbers.
 */

// --- 1. Utilities & Data ---

const TOTAL_BALLS = 45;
const SELECT_COUNT = 6;

// Weights representing "hot" numbers (simulated based on general lotto patterns)
// In a real AI model, these would be learned. Here we simulate "hot spots".
const AI_WEIGHTS = Array.from({ length: 46 }, (_, i) => {
    // Give slightly higher weight to numbers in the 10-40 range (Bell curve-ish)
    // and some random variance to simulate "trends".
    if (i === 0) return 0; // standard ball is 1-45
    let weight = 1.0;
    if (i >= 10 && i <= 35) weight += 0.3; // Center bias
    if ([1, 13, 17, 33, 40].includes(i)) weight += 0.5; // Simulate "Hot" numbers
    if ([9, 22, 41].includes(i)) weight -= 0.4; // Simulate "Cold" numbers
    return Math.max(0.1, weight + (Math.random() * 0.4 - 0.2)); // Add noise
});

let LottoHistory = [];
const MAX_HISTORY = 5;
const STORAGE_KEY = 'lotto_pro_history';

// --- 2. Filter Functions ---

/**
 * 1. Sum Filter: Checks if sum is between 120 and 170.
 */
function checkSum(numbers) {
    const sum = numbers.reduce((a, b) => a + b, 0);
    return sum >= 120 && sum <= 170;
}

/**
 * 2. AC Value (Arithmetic Complexity)
 * AC = (Unique Differences) - (Total Numbers - 1)
 * Target: 7 to 10 (Korea Lotto standard) - adjusted for stricter filtering if needed
 */
function checkAC(numbers) {
    const differences = new Set();
    for (let i = 0; i < numbers.length; i++) {
        for (let j = i + 1; j < numbers.length; j++) {
            differences.add(Math.abs(numbers[i] - numbers[j]));
        }
    }
    const acValue = differences.size - (numbers.length - 1);
    return acValue >= 7; // Generally 7+ is good complexity
}

/**
 * 3. Mirror/End Numbers
 * Checks if there is at least one pair with the same last digit (e.g. 3, 13, 23).
 */
function checkMirror(numbers) {
    const lastDigits = numbers.map(n => n % 10);
    const uniqueDigits = new Set(lastDigits);
    // If unique digits < 6, it means there's at least one duplicate ending.
    return uniqueDigits.size < 6;
}

/**
 * 4. Matrix Analysis (9-Sector)
 * Checks if numbers are too clustered in one 3x3 sector of the 7x7 grid.
 * Grid Logic: 1-7 (Row1), 8-14 (Row2), etc.
 * Simplified for 9 sectors (approximate regions).
 */
function checkMatrix(numbers) {
    // Divide 1-45 into 3 bins (1-15, 16-30, 31-45) roughly checking balance
    let low = 0, mid = 0, high = 0;
    numbers.forEach(n => {
        if (n <= 15) low++;
        else if (n <= 30) mid++;
        else high++;
    });
    // Reject if any single sector has more than 4 numbers (too clustered)
    return low <= 4 && mid <= 4 && high <= 4;
}

/**
 * 5. Exclusion Filter
 * Rejects numbers found in the user's exclusion list.
 */
function checkExclusion(numbers, excludedSet) {
    for (let n of numbers) {
        if (excludedSet.has(n)) return false;
    }
    return true;
}

/**
 * 6. Stats Utility: Odd/Even Ratio
 */
function getOddEvenRatio(numbers) {
    const odds = numbers.filter(n => n % 2 !== 0).length;
    const evens = numbers.length - odds;
    return `${odds}:${evens}`;
}

/**
 * 7. Stats Utility: High/Low Ratio (1-22 vs 23-45)
 */
function getHighLowRatio(numbers) {
    const lows = numbers.filter(n => n <= 22).length;
    const highs = numbers.length - lows;
    return `${lows}:${highs}`;
}

// --- 3. History Management ---

function saveToHistory(numbers) {
    const record = {
        numbers: [...numbers],
        date: new Date().toLocaleString('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    };

    LottoHistory.unshift(record);
    if (LottoHistory.length > MAX_HISTORY) {
        LottoHistory.pop();
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(LottoHistory));
    renderHistory();
}

function loadHistory() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            LottoHistory = JSON.parse(saved);
            renderHistory();
        } catch (e) {
            console.error("Failed to parse history", e);
            LottoHistory = [];
        }
    }
}

function renderHistory() {
    const container = document.getElementById('historyList');
    if (!container) return;

    if (LottoHistory.length === 0) {
        container.innerHTML = '<div class="history-empty">기록이 없습니다</div>';
        return;
    }

    container.innerHTML = LottoHistory.map(record => `
        <div class="history-item">
            <div class="history-balls">
                ${record.numbers.map(n => `
                    <div class="history-ball ${getBallColor(n)}" style="background: ${getBallColorHex(n)}">${n}</div>
                `).join('')}
            </div>
            <div class="history-date">${record.date}</div>
        </div>
    `).join('');
}

// Helper to get raw hex for history balls (CSS linear-gradient is too complex for simple background property here)
function getBallColorHex(num) {
    if (num <= 10) return '#facc15';
    if (num <= 20) return '#3b82f6';
    if (num <= 30) return '#ef4444';
    if (num <= 40) return '#64748b';
    return '#22c55e';
}

// --- 3. Generator Engines ---

/**
 * Basic Random Generator
 */
function generateRandomSet() {
    const set = new Set();
    while (set.size < SELECT_COUNT) {
        set.add(Math.floor(Math.random() * TOTAL_BALLS) + 1);
    }
    return Array.from(set).sort((a, b) => a - b);
}

/**
 * ⭐ 고정 번호 포함 랜덤 생성기
 * fixedSet: 반드시 포함할 번호 Set
 * excludedSet: 제외할 번호 Set
 * remaining: 추가로 채울 번호 개수
 */
function generateRandomSetWithFixed(fixedSet, excludedSet, remaining) {
    const set = new Set(fixedSet); // 고정 번호 먼저 세팅
    let tries = 0;
    while (set.size < SELECT_COUNT && tries < 1000) {
        const num = Math.floor(Math.random() * TOTAL_BALLS) + 1;
        if (!set.has(num) && !excludedSet.has(num)) {
            set.add(num);
        }
        tries++;
    }
    if (set.size < SELECT_COUNT) return null; // 생성 실패
    return Array.from(set).sort((a, b) => a - b);
}

/**
 * ⭐ 고정 번호 포함 가중치(AI) 생성기
 */
function generateWeightedSetWithFixed(fixedSet, excludedSet, remaining) {
    const set = new Set(fixedSet); // 고정 번호 먼저 세팅
    const totalWeight = AI_WEIGHTS.reduce((sum, w) => sum + w, 0);
    let tries = 0;
    while (set.size < SELECT_COUNT && tries < 1000) {
        let random = Math.random() * totalWeight;
        let runningSum = 0;
        for (let i = 1; i <= TOTAL_BALLS; i++) {
            runningSum += AI_WEIGHTS[i];
            if (random <= runningSum) {
                if (!set.has(i) && !excludedSet.has(i)) {
                    set.add(i);
                }
                break;
            }
        }
        tries++;
    }
    if (set.size < SELECT_COUNT) return null; // 생성 실패
    return Array.from(set).sort((a, b) => a - b);
}

/**
 * Weighted Generator (AI Simulation)
 * Uses roulette wheel selection based on AI_WEIGHTS.
 */
function generateWeightedSet() {
    const set = new Set();

    // Normalize weights calculation (optional, but good for understanding)
    const totalWeight = AI_WEIGHTS.reduce((sum, w) => sum + w, 0);

    while (set.size < SELECT_COUNT) {
        let random = Math.random() * totalWeight;
        let runningSum = 0;
        for (let i = 1; i <= TOTAL_BALLS; i++) {
            runningSum += AI_WEIGHTS[i];
            if (random <= runningSum) {
                if (!set.has(i)) {
                    set.add(i);
                }
                break;
            }
        }
    }
    return Array.from(set).sort((a, b) => a - b);
}

// --- 4. Main Simulation Logic ---

async function runMonteCarloSimulation() {
    // 1. Get Settings
    const useSum = document.getElementById('filterSum').checked;
    const useAC = document.getElementById('filterAC').checked;
    const useMirror = document.getElementById('filterMirror').checked;
    const useMatrix = document.getElementById('filterMatrix').checked;
    const useMonteCarlo = document.getElementById('filterMonteCarlo').checked;
    const useAI = document.getElementById('filterAI').checked;

    // Parse Exclusions
    const exclusionInput = document.getElementById('exclusionInput').value;
    const excludedSet = new Set(
        exclusionInput.split(',')
            .map(s => parseInt(s.trim()))
            .filter(n => !isNaN(n))
    );

    // ⭐ Parse Fixed Numbers (고정 번호 파싱)
    const fixedNums = [];
    const fixedVal1 = parseInt(document.getElementById('fixedNum1').value);
    const fixedVal2 = parseInt(document.getElementById('fixedNum2').value);

    if (!isNaN(fixedVal1) && fixedVal1 >= 1 && fixedVal1 <= 45) fixedNums.push(fixedVal1);
    if (!isNaN(fixedVal2) && fixedVal2 >= 1 && fixedVal2 <= 45) fixedNums.push(fixedVal2);

    // 유효성 검사: 고정 번호 중복 체크
    if (fixedNums.length === 2 && fixedNums[0] === fixedNums[1]) {
        alert('고정 번호 두 개가 같습니다. 다른 번호를 입력해주세요.');
        return { numbers: null, score: -1 };
    }
    // 유효성 검사: 고정 번호가 제외수와 겹치는지 체크
    for (const fn of fixedNums) {
        if (excludedSet.has(fn)) {
            alert(`고정 번호 ${fn}이(가) 제외수에 포함되어 있습니다. 확인해주세요.`);
            return { numbers: null, score: -1 };
        }
    }

    // 2. Setup Simulation
    const SIMULATION_COUNT = useMonteCarlo ? 10000 : 100; // Run less if MC is off
    const progressBar = document.getElementById('progressBar');
    const loadingLog = document.getElementById('loadingLog');
    const loadingText = document.getElementById('loadingText');

    let bestSet = null;
    let maxScore = -1;

    // 3. Run Loop
    // Use chunks to yield to the UI thread for animation
    const CHUNK_SIZE = 500;

    for (let i = 0; i < SIMULATION_COUNT; i += CHUNK_SIZE) {
        // Yield to UI
        await new Promise(resolve => requestAnimationFrame(resolve));

        // Update UI
        const progress = Math.min(100, Math.round((i / SIMULATION_COUNT) * 100));
        progressBar.style.width = `${progress}%`;
        loadingLog.innerText = `Simulating batch ${i} - ${i + CHUNK_SIZE}...`;

        // Dynamic Text
        if (i > SIMULATION_COUNT * 0.3) loadingText.innerText = "AC 복잡도 분석 중...";
        if (i > SIMULATION_COUNT * 0.6) loadingText.innerText = "9궁도 패턴 매칭 중...";
        if (i > SIMULATION_COUNT * 0.9) loadingText.innerText = "최적 번호 선별 중...";

        // Logic Chunk
        for (let j = 0; j < CHUNK_SIZE; j++) {
            if (i + j >= SIMULATION_COUNT) break;

            // ⭐ 고정 번호를 먼저 세팅하고, 나머지 자리만 채우기
            const fixedSet = new Set(fixedNums);
            const remaining = SELECT_COUNT - fixedSet.size; // 채워야 할 나머지 자리 수

            // 나머지 번호 생성 (고정 번호 & 제외수 제외)
            let candidate;
            if (useAI) {
                candidate = generateWeightedSetWithFixed(fixedSet, excludedSet, remaining);
            } else {
                candidate = generateRandomSetWithFixed(fixedSet, excludedSet, remaining);
            }
            if (!candidate) continue; // 생성 실패 시 스킵

            // Calculate Score based on Filters
            let score = 0;

            // Base Score (Randomness)
            score += Math.random() * 10;

            // Filter Scored Checks
            if (useSum) score += checkSum(candidate) ? 20 : -50; // Heavily penalize bad sum
            if (useAC) score += checkAC(candidate) ? 15 : -20;
            if (useMirror) score += checkMirror(candidate) ? 10 : 0; // Bonus for patterns
            if (useMatrix) score += checkMatrix(candidate) ? 10 : -10;

            if (score > maxScore) {
                maxScore = score;
                bestSet = candidate;
            }
        }
    }

    return { numbers: bestSet, score: maxScore };
}

// --- 5. UI Rendering ---

function getBallColor(num) {
    if (num <= 10) return 'ball-yellow';
    if (num <= 20) return 'ball-blue';
    if (num <= 30) return 'ball-red';
    if (num <= 40) return 'ball-grey';
    return 'ball-green';
}

function renderBalls(numbers) {
    const container = document.getElementById('ballsContainer');
    container.innerHTML = ''; // Clear

    numbers.forEach((num, index) => {
        const ball = document.createElement('div');
        ball.classList.add('lotto-ball', getBallColor(num));
        ball.innerText = num;

        // Staggered animation delay: 0.5s interval for 'Pop-Pop-Pop' effect
        ball.style.animationDelay = `${index * 0.5}s`;

        container.appendChild(ball);
    });

    // Update Status
    const statusLog = document.getElementById('statusLog');
    const sum = numbers.reduce((a, b) => a + b, 0);
    statusLog.innerText = `추출 완료! 총합: ${sum} / 시스템 적합도: 최상`;

    // Play Sound (Optional, browser policy restricts auto audio, leaving as placeholder)
}

// --- 6. Event Listeners ---

document.getElementById('generateBtn').addEventListener('click', async () => {
    // Show Loading
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = 'flex';
    overlay.style.opacity = 1;

    try {
        // Run Async Logic
        const result = await runMonteCarloSimulation();

        // Add a small artificial delay for "Dramatic Effect" if too fast
        await new Promise(r => setTimeout(r, 500));

        // Hide overlay
        overlay.style.display = 'none';

        // Render Result
        if (result && result.numbers) {
            renderBalls(result.numbers);

            // Update Stats Display
            document.getElementById('statSum').innerText = `Sum: ${result.numbers.reduce((a, b) => a + b, 0)}`;
            document.getElementById('statAC').innerText = `AC: ${getACValue(result.numbers)}`;
            document.getElementById('statOddEven').innerText = `홀짝: ${getOddEvenRatio(result.numbers)}`;
            document.getElementById('statHighLow').innerText = `고저: ${getHighLowRatio(result.numbers)}`;
            document.getElementById('statScore').innerText = `Score: ${Math.floor(result.score)}`;

            // Save to History
            saveToHistory(result.numbers);
        } else {
            alert("조건에 맞는 번호를 찾지 못했습니다. 필터를 조금 완화해보세요.");
        }

    } catch (e) {
        console.error(e);
        alert("시스템 오류 발생");
        overlay.style.display = 'none';
    }
});

function getACValue(numbers) {
    const differences = new Set();
    for (let i = 0; i < numbers.length; i++) {
        for (let j = i + 1; j < numbers.length; j++) {
            differences.add(Math.abs(numbers[i] - numbers[j]));
        }
    }
    return differences.size - (numbers.length - 1);
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    loadHistory();
});
