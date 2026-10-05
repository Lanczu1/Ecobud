self.addEventListener('push', event => {
  let payload;
  try { payload=event.data?.json(); } catch { return; }
  if (!payload?.notificationId || typeof payload.notificationId!=='string') return;
  event.waitUntil(self.registration.showNotification('ECOBUD admin update',{
    body:'An update needs your attention. Sign in to view details.',
    tag:typeof payload.tag==='string' ? payload.tag : 'ecobud-admin',
    data:{ notificationId:payload.notificationId },
  }));
});
self.addEventListener('notificationclick',event => {
  event.notification.close();
  const id=event.notification.data?.notificationId;
  if (typeof id!=='string') return;
  const url=new URL('/',self.location.origin);
  url.hash=`admin?${new URLSearchParams({ section:'Notifications',notification:id })}`;
  event.waitUntil(self.clients.matchAll({ type:'window',includeUncontrolled:true }).then(async clients => {
    const existing=clients.find(client => new URL(client.url).origin===self.location.origin);
    if (existing) { await existing.navigate(url.href); await existing.focus(); }
    else await self.clients.openWindow(url.href);
  }));
});
