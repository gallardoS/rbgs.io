// Keep the brand identical wherever it appears in localized product copy.
export function BrandText({ text }: { text: string }) {
  return <>{text.split(/(rbgs\.io)/g).map((part, index) => part === 'rbgs.io'
    ? <span className="brand" key={index}>{part}</span>
    : part)}</>;
}
