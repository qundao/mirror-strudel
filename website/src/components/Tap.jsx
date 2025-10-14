import React, { useState, useRef, useEffect } from 'react';

export default function Tap({ initialCps = 0.4, maxSamples = 3 }) {
  const [timestamps, setTimestamps] = useState([]);
  const [cps, setCps] = useState(initialCps);

  function addTap(ts = Date.now()) {
    setTimestamps((prev) => {
      const next = [...prev, ts].slice(-(maxSamples + 1));
      calcCps(next);
      return next;
    });
  }

  function calcCps(times) {
    if (!times || times.length < 2) return;
    const intervals = [];
    for (let i = 1; i < times.length; i++) {
      intervals.push(times[i] - times[i - 1]);
    }

    const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const newCps = 1000 / avgMs;
    if (Number.isFinite(newCps) && newCps > 0 && newCps < 1000) {
      setCps(newCps);
    }
  }

  function handleTap(e) {
    e && e.preventDefault();
    addTap();
  }

  function handleReset(e) {
    e && e.preventDefault();
    reset();
  }

  useEffect(() => {
    function onKey(e) {
      if (e.code === 'Space') {
        e.preventDefault();
        addTap();
      } else if (e.code === 'Backspace') {
        e.preventDefault();
        reset();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function reset() {
    setTimestamps([]);
    // setCps(initialCps);
  }

  return (
    <div>
      <div class="flex flex-col items-center p-7 font-medium text-white">
        <div>{cps.toFixed(2)} cps</div>
        <button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" onClick={handleTap}>
          Tap
        </button>
      </div>
    </div>
  );
}
