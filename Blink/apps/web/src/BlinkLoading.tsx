/** Keep the shape of content visible while the existing request is pending. */
export default function BlinkLoading({ label = 'Loading…', layout = 'cards', count = 3 }: {
  label?: string; layout?: 'cards' | 'rows' | 'profile' | 'moments'; count?: number;
}) {
  return <div className={`blink-loading loading-${layout}`} role="status" aria-label={label}>
    <span className="polish-sr-only">{label}</span>
    {Array.from({ length: count }, (_, index) => <div className="blink-loading-card" key={index} aria-hidden="true">
      <span className="blink-loading-art" /><i /><i /><i />
    </div>)}
  </div>;
}
