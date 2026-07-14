import { useEffect } from 'react';

export default function GlobalButtonFeedback() {
  useEffect(() => {
    function handleClick(event) {
      const button = event.target.closest('button');
      if (!button || button.disabled) return;

      button.classList.remove('tdm-click-feedback');
      void button.offsetWidth;
      button.classList.add('tdm-click-feedback');

      window.setTimeout(() => {
        button.classList.remove('tdm-click-feedback');
      }, 450);
    }

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  return null;
}
