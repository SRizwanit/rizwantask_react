/* <dialog> মোড়ক: open = true হলে showModal(), false হলে close(); বন্ধ হলে (Esc সহ) onClose ডাকে।
   খোলা ড্রপডাউনে Esc চাপলে শুধু ড্রপডাউন বন্ধ হয়, পুরো ডায়ালগ নয়। */
import { useLayoutEffect, useRef } from 'react';
import { closeDropdown } from './Dropdown.jsx';

export default function Dialog({ id, open, onClose, children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog id={id} ref={ref} onClose={() => onClose && onClose()} onCancel={(e) => { if (closeDropdown()) e.preventDefault(); }}>
      {children}
    </dialog>
  );
}
