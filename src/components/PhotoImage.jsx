import React, { useEffect, useRef, useState } from 'react';
import { getSignedPhotoUrl, PHOTO_URL_TTL } from '../services/photoAccessService';

// A business reference is never replaced by a temporary URL in the source row.
export default function PhotoImage({ photo, purpose='preview', alt='', ...props }) {
  const reference = typeof photo === 'string' ? photo : JSON.stringify({
    storage_bucket:photo?.storage_bucket, storage_path:photo?.storage_path,
    photo_url:photo?.photo_url || photo?.photo_principale_url,
    thumbnail_url:photo?.thumbnail_url || photo?.photo_miniature_url
  });
  const [resolved, setResolved] = useState({ reference:'', url:'' });
  const element=useRef(null);
  const [visible,setVisible]=useState(props.loading!=='lazy');
  useEffect(()=>{
    if(props.loading!=='lazy'||typeof IntersectionObserver==='undefined'){setVisible(true);return;}
    setVisible(false);
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'200px'});
    if(element.current)observer.observe(element.current);
    return()=>observer.disconnect();
  },[reference,props.loading]);
  useEffect(() => {
    if(!visible)return;
    let live = true, request = 0;
    const resolve = async () => {
      const current = ++request;
      setResolved({ reference, url:'' });
      try {
        const url = await getSignedPhotoUrl(typeof photo === 'string' ? photo : JSON.parse(reference), { purpose });
        if (live && current === request) setResolved({ reference, url });
      } catch { /* Fail closed, including offline and expired sessions. */ }
    };
    resolve();
    const timer = setInterval(resolve, Math.max(1, (PHOTO_URL_TTL[purpose] || 300) - 30) * 1000);
    window.addEventListener('tos-photo-access-change', resolve);
    window.addEventListener('online', resolve);
    window.addEventListener('focus', resolve);
    return () => {
      live = false; request += 1; clearInterval(timer);
      window.removeEventListener('tos-photo-access-change', resolve);
      window.removeEventListener('online', resolve);
      window.removeEventListener('focus', resolve);
    };
  }, [reference, purpose, visible]);
  const url = resolved.reference === reference ? resolved.url : '';
  return url ? <img {...props} ref={element} src={url} alt={alt} onError={() => { setResolved({ reference, url:'' }); }}/>
    : <span ref={element} className={props.className} role="status" title={alt} style={props.loading==='lazy'?{display:'inline-block',minHeight:120,minWidth:120}:undefined}>{visible?'Aperçu indisponible':'Chargement de l’aperçu…'}</span>;
}
