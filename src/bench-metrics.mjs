export function frameMetrics(times) {
  if (!times.length || times.some(dt=>!Number.isFinite(dt) || dt<=0)) throw new Error('Invalid frame samples');
  const sorted=[...times].sort((a,b)=>a-b);
  const total=times.reduce((sum,dt)=>sum+dt,0);
  const count=Math.max(1,Math.ceil(times.length*.01));
  const tail=sorted.slice(-count).reduce((sum,dt)=>sum+dt,0);
  return {
    avg_fps:1000*times.length/total,
    p1_low_fps:1000*count/tail,
    frame_ms_p95:sorted[Math.ceil(.95*times.length)-1],
    frames:times.length,
  };
}
