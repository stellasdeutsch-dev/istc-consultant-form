/* ============================================================
   Icon set — solid / duotone glyphs (deliberately not monoline
   outline icons). Each entry is the inner markup of a 24×24
   viewBox: a lighter backing layer at reduced opacity plus a
   solid foreground, both inheriting currentColor.

   Also wires icons into the form: leading glyphs inside text
   inputs, badges on option cards, and a badge per step heading.
   ============================================================ */

'use strict';

const ICONS = {
  /* --- people & identity --- */
  user:
    '<circle cx="12" cy="7.8" r="3.9" fill="currentColor" opacity=".35"/>' +
    '<path d="M12 13.3c-3.9 0-7.1 2.4-7.1 5.5 0 .8.7 1.4 1.5 1.4h11.2c.8 0 1.5-.6 1.5-1.4 0-3.1-3.2-5.5-7.1-5.5Z" fill="currentColor"/>',
  building:
    '<path d="M3.4 5.6c0-1 .8-1.8 1.8-1.8h6.2c1 0 1.8.8 1.8 1.8V20.4H3.4V5.6Z" fill="currentColor" opacity=".35"/>' +
    '<path d="M13.2 9.4h5.6c1 0 1.8.8 1.8 1.8v9.2h-7.4V9.4Z" fill="currentColor"/>' +
    '<path d="M6 7.2h1.9v1.9H6zM9.5 7.2h1.9v1.9H9.5zM6 11h1.9v1.9H6zM9.5 11h1.9v1.9H9.5zM6 14.8h1.9v1.9H6zM9.5 14.8h1.9v1.9H9.5z" fill="currentColor"/>',
  flag:
    '<path d="M6.4 2.6c.7 0 1.2.6 1.2 1.2v17c0 .6-.5 1.1-1.2 1.1s-1.2-.5-1.2-1.1v-17c0-.6.5-1.2 1.2-1.2Z" fill="currentColor"/>' +
    '<path d="M8.8 4.1h9.6c1 0 1.5 1.1.9 1.9l-1.9 2.4c-.3.4-.3.9 0 1.3l1.9 2.4c.6.8.1 1.9-.9 1.9H8.8V4.1Z" fill="currentColor" opacity=".5"/>',
  globe:
    '<circle cx="12" cy="12" r="9" fill="currentColor" opacity=".35"/>' +
    '<path d="M3.5 11.1h17v1.8h-17z" fill="currentColor"/>' +
    '<path d="M12 3c-1.6 2.6-2.4 5.7-2.4 9s.8 6.4 2.4 9c1.6-2.6 2.4-5.7 2.4-9S13.6 5.6 12 3Z" fill="currentColor"/>' +
    '<path d="M5.6 6.6h12.8v1.5H5.6zM5.6 15.9h12.8v1.5H5.6z" fill="currentColor" opacity=".55"/>',
  mail:
    '<rect x="2.4" y="4.6" width="19.2" height="14.8" rx="2.7" fill="currentColor" opacity=".32"/>' +
    '<path d="M3.4 6.9 11 12c.6.4 1.4.4 2 0l7.6-5.1c-.5-.8-1.3-1.3-2.3-1.3H5.7c-1 0-1.8.5-2.3 1.3Z" fill="currentColor"/>',
  phone:
    '<path d="M8.2 3.2 5.5 4.4c-1 .5-1.6 1.6-1.3 2.7 1.7 6.1 6.6 11 12.7 12.7 1.1.3 2.2-.3 2.7-1.3l1.2-2.7c.3-.8 0-1.7-.8-2l-3.5-1.6c-.7-.3-1.5-.1-1.9.5l-.9 1.2c-1.9-1.1-3.5-2.7-4.6-4.6l1.2-.9c.6-.4.8-1.2.5-1.9L9.2 3c-.3-.8-1.2-1.1-2-.8Z" fill="currentColor"/>',
  hash:
    '<rect x="3" y="3" width="18" height="18" rx="4.5" fill="currentColor" opacity=".32"/>' +
    '<path d="M10.1 7.2h1.8l-.5 2.6h2.1l.5-2.6h1.8l-.5 2.6h1.9v1.7h-2.2l-.4 2.2h2v1.7h-2.3l-.5 2.6h-1.8l.5-2.6h-2.1l-.5 2.6H8.1l.5-2.6H6.7v-1.7h2.2l.4-2.2h-2V9.8h2.3l.5-2.6Zm.3 4.3-.4 2.2h2.1l.4-2.2h-2.1Z" fill="currentColor"/>',
  translate:
    '<rect x="2.6" y="2.6" width="12.6" height="12.6" rx="3.2" fill="currentColor" opacity=".35"/>' +
    '<path d="M8.8 8.8h12.6v12.6H8.8z" fill="none"/>' +
    '<path d="M12 8.8h6.2c1.8 0 3.2 1.4 3.2 3.2v6.2c0 1.8-1.4 3.2-3.2 3.2H12c-1.8 0-3.2-1.4-3.2-3.2V12c0-1.8 1.4-3.2 3.2-3.2Zm3.1 3.3-2.6 6.4h1.7l.5-1.4h2.5l.5 1.4h1.7l-2.6-6.4h-1.7Zm.9 2 .7 1.8h-1.5l.8-1.8Z" fill="currentColor"/>' +
    '<path d="M8.4 4.6v1H5.2v1.3h5.1c-.3 1-.9 1.9-1.6 2.7-.4-.4-.7-.9-1-1.4H6.3c.3.8.8 1.6 1.4 2.3-.6.5-1.3.9-2 1.2l.5 1.3c.9-.4 1.7-.9 2.4-1.5.7.6 1.5 1.1 2.4 1.5l.5-1.3c-.7-.3-1.4-.7-2-1.2 1-1.1 1.8-2.4 2.1-3.9h1V5.6H9.7v-1H8.4Z" fill="currentColor"/>',

  /* --- documents --- */
  doc:
    '<path d="M5.4 4.2c0-1.1.9-2 2-2h6.1L20 8.7v11.1c0 1.1-.9 2-2 2H7.4c-1.1 0-2-.9-2-2V4.2Z" fill="currentColor" opacity=".35"/>' +
    '<path d="M13.5 2.2 20 8.7h-4.6c-1 0-1.9-.8-1.9-1.9V2.2Z" fill="currentColor"/>' +
    '<path d="M8.4 12.4h7.2v1.7H8.4zM8.4 15.9h4.9v1.7H8.4z" fill="currentColor"/>',
  award:
    '<circle cx="12" cy="9.2" r="6.4" fill="currentColor" opacity=".35"/>' +
    '<path d="m8.2 14.6-1.5 6.1c-.2.8.7 1.4 1.4 1l3.9-2.2 3.9 2.2c.7.4 1.6-.2 1.4-1l-1.5-6.1a7.9 7.9 0 0 1-7.6 0Z" fill="currentColor"/>' +
    '<path d="m12 5.6 1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.2-2.4 1.2.5-2.6-1.9-1.8 2.6-.4L12 5.6Z" fill="currentColor"/>',
  book:
    '<path d="M3.4 5.4c0-1.3 1-2.3 2.3-2.3H12v17.8H5.7c-1.3 0-2.3-1-2.3-2.3V5.4Z" fill="currentColor" opacity=".35"/>' +
    '<path d="M12 3.1h6.3c1.3 0 2.3 1 2.3 2.3v13.2c0 1.3-1 2.3-2.3 2.3H12V3.1Z" fill="currentColor"/>',
  clipboard:
    '<path d="M4.6 5.9c0-1.2 1-2.2 2.2-2.2h10.4c1.2 0 2.2 1 2.2 2.2v13.7c0 1.2-1 2.2-2.2 2.2H6.8c-1.2 0-2.2-1-2.2-2.2V5.9Z" fill="currentColor" opacity=".35"/>' +
    '<path d="M9.2 2h5.6c.9 0 1.6.7 1.6 1.6v1.5c0 .9-.7 1.6-1.6 1.6H9.2c-.9 0-1.6-.7-1.6-1.6V3.6C7.6 2.7 8.3 2 9.2 2Z" fill="currentColor"/>' +
    '<path d="m10.8 16.4-2.3-2.3 1.3-1.3 1 1 3.4-3.4 1.3 1.3-4.7 4.7Z" fill="currentColor"/>',

  /* --- domains --- */
  shield:
    '<path d="M12 2.2 4.9 5.1v6.1c0 4.4 3 8.5 7.1 10.6 4.1-2.1 7.1-6.2 7.1-10.6V5.1L12 2.2Z" fill="currentColor" opacity=".35"/>' +
    '<path d="m11 15.3-3.2-3.2 1.4-1.4 1.8 1.8 4.3-4.3 1.4 1.4-5.7 5.7Z" fill="currentColor"/>',
  flask:
    '<path d="M9.4 3.2h5.2v5.4l4.3 8c1 1.8-.3 4-2.4 4H7.5c-2.1 0-3.4-2.2-2.4-4l4.3-8V3.2Z" fill="currentColor" opacity=".35"/>' +
    '<path d="M8.6 2h6.8c.6 0 1 .4 1 1s-.4 1-1 1H8.6c-.6 0-1-.4-1-1s.4-1 1-1Z" fill="currentColor"/>' +
    '<path d="M7.4 14.4h9.2l2 3.7c.6 1.1-.2 2.5-1.5 2.5H6.9c-1.3 0-2.1-1.4-1.5-2.5l2-3.7Z" fill="currentColor"/>',
  bio:
    '<circle cx="12" cy="12" r="8.4" fill="currentColor" opacity=".35"/>' +
    '<path d="M12 1.6c.7 0 1.2.5 1.2 1.2v1.5h-2.4V2.8c0-.7.5-1.2 1.2-1.2ZM12 19.7h1.2v1.5c0 .7-.5 1.2-1.2 1.2s-1.2-.5-1.2-1.2v-1.5H12ZM1.6 12c0-.7.5-1.2 1.2-1.2h1.5v2.4H2.8c-.7 0-1.2-.5-1.2-1.2ZM19.7 10.8h1.5c.7 0 1.2.5 1.2 1.2s-.5 1.2-1.2 1.2h-1.5v-2.4ZM4.6 3.2l1.7 1.7-1.7 1.7L2.9 4.9 4.6 3.2ZM19.4 3.2l1.7 1.7-1.7 1.7-1.7-1.7 1.7-1.7ZM4.6 17.4l1.7 1.7-1.7 1.7-1.7-1.7 1.7-1.7ZM19.4 17.4l1.7 1.7-1.7 1.7-1.7-1.7 1.7-1.7Z" fill="currentColor"/>' +
    '<circle cx="12" cy="12" r="3" fill="currentColor"/>',
  // Radiation trefoil — reads instantly at 18px where orbit rings do not
  atom:
    '<circle cx="12" cy="12" r="9.6" fill="currentColor" opacity=".28"/>' +
    '<path d="M10.3 9.06 7.7 4.55a8.6 8.6 0 0 1 8.6 0L13.7 9.06a3.4 3.4 0 0 0-3.4 0Z" fill="currentColor"/>' +
    '<path d="M15.4 12h5.2a8.6 8.6 0 0 1-4.3 7.45l-2.6-4.51A3.4 3.4 0 0 0 15.4 12Z" fill="currentColor"/>' +
    '<path d="M10.3 14.94 7.7 19.45A8.6 8.6 0 0 1 3.4 12h5.2a3.4 3.4 0 0 0 1.7 2.94Z" fill="currentColor"/>' +
    '<circle cx="12" cy="12" r="2.4" fill="currentColor"/>',
  alert:
    '<path d="M13.7 3.5a2 2 0 0 0-3.4 0L2.6 17.4c-.8 1.4.2 3 1.7 3h15.4c1.5 0 2.5-1.6 1.7-3L13.7 3.5Z" fill="currentColor" opacity=".35"/>' +
    '<path d="M11 8.4h2v5.8h-2Z" fill="currentColor"/>' +
    '<circle cx="12" cy="16.9" r="1.35" fill="currentColor"/>',
  scale:
    '<path d="M11 2.6h2v18.8h-2z" fill="currentColor"/>' +
    '<path d="M6.4 20.4h11.2c.6 0 1 .4 1 1s-.4 1-1 1H6.4c-.6 0-1-.4-1-1s.4-1 1-1ZM4 5.6h16v2H4z" fill="currentColor"/>' +
    '<path d="M6.6 6.6 3 14.4h7.2L6.6 6.6ZM17.4 6.6l-3.6 7.8H21l-3.6-7.8Z" fill="currentColor" opacity=".35"/>',
  pulse:
    '<rect x="2.2" y="4.6" width="19.6" height="14.8" rx="3.4" fill="currentColor" opacity=".32"/>' +
    '<path d="M5 12.9h2.9l1.8-4.6c.3-.8 1.4-.8 1.7 0l2.5 7 1.3-2.9c.2-.3.5-.5.9-.5H19v1.9h-2.3l-2.1 4.4c-.3.8-1.4.7-1.7-.1l-2.4-6.8-1 2.7c-.2.4-.5.7-.9.7H5v-1.8Z" fill="currentColor"/>',
  climate:
    '<path d="M9.4 3.8a2.9 2.9 0 0 1 5.8 0v8.4a5.2 5.2 0 1 1-5.8 0V3.8Z" fill="currentColor" opacity=".35"/>' +
    '<path d="M12 5.4c.5 0 1 .4 1 1v8.2a2.6 2.6 0 1 1-2 0V6.4c0-.6.4-1 1-1Z" fill="currentColor"/>' +
    '<path d="M17.2 4.4h5v1.8h-5zM17.2 8.2h5V10h-5z" fill="currentColor" opacity=".35"/>',
  rocket:
    '<path d="M12 1.8c3.3 2.6 5.2 6.5 5.2 10.6v3.4H6.8v-3.4c0-4.1 1.9-8 5.2-10.6Z" fill="currentColor" opacity=".35"/>' +
    '<circle cx="12" cy="9.4" r="2.2" fill="currentColor"/>' +
    '<path d="M6.8 12.4v4.6l-3.2 1.9v-3.3c0-.6.2-1.1.6-1.5l2.6-1.7ZM17.2 12.4l2.6 1.7c.4.4.6.9.6 1.5v3.3L17.2 17v-4.6Z" fill="currentColor"/>' +
    '<path d="M10.2 17.2h3.6L12 22.2l-1.8-5Z" fill="currentColor"/>',
  lock:
    '<rect x="4.2" y="10" width="15.6" height="11.6" rx="3" fill="currentColor" opacity=".35"/>' +
    '<path d="M12 2.4c-3 0-5.4 2.4-5.4 5.4V11h2.8V7.8c0-1.4 1.2-2.6 2.6-2.6s2.6 1.2 2.6 2.6V11h2.8V7.8c0-3-2.4-5.4-5.4-5.4Z" fill="currentColor"/>' +
    '<circle cx="12" cy="15.4" r="2" fill="currentColor"/>' +
    '<path d="M11 16.6h2v2.8h-2z" fill="currentColor"/>',
  facility:
    '<path d="M3.2 9.6 12 4.4l8.8 5.2v10c0 .9-.7 1.6-1.6 1.6H4.8c-.9 0-1.6-.7-1.6-1.6v-10Z" fill="currentColor" opacity=".35"/>' +
    '<path d="M12 2.4 22.2 8.5l-1 1.7L12 4.7 2.8 10.2l-1-1.7L12 2.4Z" fill="currentColor"/>' +
    '<path d="M9.4 13h5.2v8.2H9.4z" fill="currentColor"/>',
  eye:
    '<path d="M12 4.6c-5 0-9.1 3.4-10.7 7.4C2.9 16 7 19.4 12 19.4s9.1-3.4 10.7-7.4C21.1 8 17 4.6 12 4.6Z" fill="currentColor" opacity=".35"/>' +
    '<circle cx="12" cy="12" r="4" fill="currentColor"/>',
  box:
    '<path d="M3 7.8 12 3l9 4.8v8.4L12 21l-9-4.8V7.8Z" fill="currentColor" opacity=".35"/>' +
    '<path d="m3 7.8 9 4.8 9-4.8-9-4.8-9 4.8Z" fill="currentColor"/>' +
    '<path d="M11 12.4h2V21h-2z" fill="currentColor"/>',
  chart:
    '<rect x="2.6" y="3.4" width="18.8" height="17.2" rx="3.4" fill="currentColor" opacity=".32"/>' +
    '<path d="M6.6 13.4h2.2v4H6.6zM10.9 8.4h2.2v9h-2.2zM15.2 11h2.2v6.4h-2.2z" fill="currentColor"/>',
  sparkle:
    '<path d="m12 2.4 2.1 5.2 5.2 2.1-5.2 2.1L12 17l-2.1-5.2L4.7 9.7l5.2-2.1L12 2.4Z" fill="currentColor" opacity=".4"/>' +
    '<path d="m18.4 15.2 1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1 1-2.4Z" fill="currentColor"/>',

  /* --- availability & time --- */
  clock:
    '<circle cx="12" cy="12" r="9.2" fill="currentColor" opacity=".35"/>' +
    '<path d="M11 6.2h2v6.2l4 2.4-1 1.7-5-3V6.2Z" fill="currentColor"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16.2" rx="3.2" fill="currentColor" opacity=".35"/>' +
    '<path d="M3 10.2h18v2H3zM7 2.4c.6 0 1 .4 1 1v3c0 .6-.4 1-1 1s-1-.4-1-1v-3c0-.6.4-1 1-1ZM17 2.4c.6 0 1 .4 1 1v3c0 .6-.4 1-1 1s-1-.4-1-1v-3c0-.6.4-1 1-1Z" fill="currentColor"/>' +
    '<path d="M7 14.4h2.4v2.4H7zM10.8 14.4h2.4v2.4h-2.4z" fill="currentColor"/>',
  hourglass:
    '<path d="M6 2.6h12c.6 0 1 .4 1 1s-.4 1-1 1H6c-.6 0-1-.4-1-1s.4-1 1-1ZM6 19.4h12c.6 0 1 .4 1 1s-.4 1-1 1H6c-.6 0-1-.4-1-1s.4-1 1-1Z" fill="currentColor"/>' +
    '<path d="M7 4.6h10v2.2c0 2-1.2 3.8-3 4.6v1.2c1.8.8 3 2.6 3 4.6v2.2H7v-2.2c0-2 1.2-3.8 3-4.6v-1.2c-1.8-.8-3-2.6-3-4.6V4.6Z" fill="currentColor" opacity=".35"/>',
  remote:
    '<rect x="2.4" y="4" width="19.2" height="13" rx="2.6" fill="currentColor" opacity=".35"/>' +
    '<path d="M2.4 18.4h19.2c.6 0 1 .5 1 1s-.4 1-1 1H2.4c-.6 0-1-.5-1-1s.4-1 1-1Z" fill="currentColor"/>' +
    '<path d="M12 7.2c1.9 0 3.6.8 4.9 2l-1.4 1.4a5 5 0 0 0-7 0L7.1 9.2a6.9 6.9 0 0 1 4.9-2Zm0 3.4c1 0 1.9.4 2.6 1.1l-1.4 1.4a1.7 1.7 0 0 0-2.4 0l-1.4-1.4c.7-.7 1.6-1.1 2.6-1.1Z" fill="currentColor"/>',
  pin:
    '<path d="M12 2c-4 0-7.2 3.2-7.2 7.2 0 5.2 6.2 11.7 6.5 12 .4.4 1 .4 1.4 0 .3-.3 6.5-6.8 6.5-12C19.2 5.2 16 2 12 2Z" fill="currentColor" opacity=".35"/>' +
    '<circle cx="12" cy="9.2" r="3.2" fill="currentColor"/>',

  /* --- misc --- */
  briefcase:
    '<rect x="2.4" y="6.6" width="19.2" height="14" rx="3" fill="currentColor" opacity=".35"/>' +
    '<path d="M9 2.4h6c1.4 0 2.6 1.2 2.6 2.6v2.4h-2.4V5.2c0-.2-.1-.4-.4-.4H9.2c-.2 0-.4.2-.4.4v2.2H6.4V5c0-1.4 1.2-2.6 2.6-2.6Z" fill="currentColor"/>' +
    '<path d="M2.4 11.4h19.2v2.2c0 .9-.7 1.6-1.6 1.6h-6v-1.4h-4v1.4H4c-.9 0-1.6-.7-1.6-1.6v-2.2Z" fill="currentColor"/>',
  euro:
    '<circle cx="12" cy="12" r="9.4" fill="currentColor" opacity=".32"/>' +
    '<path d="M15.6 8.4a3.7 3.7 0 0 0-5.9 1.1h4.2v1.6H9.3a5 5 0 0 0 0 1.4h4.6v1.6H9.7a3.7 3.7 0 0 0 5.9 1.1l1.3 1.3a5.6 5.6 0 0 1-9.1-2.4H6.2v-1.6h1.3a6.7 6.7 0 0 1 0-1.4H6.2V9.5h1.6a5.6 5.6 0 0 1 9.1-2.4l-1.3 1.3Z" fill="currentColor"/>',
  history:
    '<circle cx="12" cy="12" r="9.2" fill="currentColor" opacity=".32"/>' +
    '<path d="M11 6.6h2v5.9l3.7 2.2-1 1.7-4.7-2.8V6.6Z" fill="currentColor"/>' +
    '<path d="M4.6 2.8 6 8.2.6 6.8l4-4Z" fill="currentColor"/>',
  cross:
    '<circle cx="12" cy="12" r="9.2" fill="currentColor" opacity=".32"/>' +
    '<path d="m8.5 7.1 3.5 3.5 3.5-3.5 1.4 1.4-3.5 3.5 3.5 3.5-1.4 1.4-3.5-3.5-3.5 3.5-1.4-1.4 3.5-3.5-3.5-3.5 1.4-1.4Z" fill="currentColor"/>',
  check:
    '<circle cx="12" cy="12" r="9.2" fill="currentColor" opacity=".32"/>' +
    '<path d="m10.7 15.9-4-4 1.4-1.4 2.6 2.6 5.2-5.2 1.4 1.4-6.6 6.6Z" fill="currentColor"/>',
  pen:
    '<path d="M3.4 16.9 16.2 4.1l3.7 3.7L7.1 20.6l-4.5.8.8-4.5Z" fill="currentColor" opacity=".35"/>' +
    '<path d="M17.5 2.8a1.9 1.9 0 0 1 2.7 0l1 1a1.9 1.9 0 0 1 0 2.7l-1.1 1.1-3.7-3.7 1.1-1.1Z" fill="currentColor"/>',
  layers:
    '<path d="m12 2.6 9.4 4.9-9.4 4.9-9.4-4.9L12 2.6Z" fill="currentColor"/>' +
    '<path d="m3.9 11.1-1.3.7 9.4 4.9 9.4-4.9-1.3-.7-8.1 4.2-8.1-4.2ZM3.9 15.5l-1.3.7 9.4 4.9 9.4-4.9-1.3-.7-8.1 4.2-8.1-4.2Z" fill="currentColor" opacity=".4"/>',
  upload:
    '<rect x="2.6" y="3" width="18.8" height="18" rx="4" fill="currentColor" opacity=".3"/>' +
    '<path d="M12 6.2 7.4 11h2.9v4.5h3.4V11h2.9L12 6.2ZM7.6 17h8.8v1.9H7.6z" fill="currentColor"/>',
};

function icon(name, cls = '') {
  const body = ICONS[name];
  if (!body) return '';
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
}

/* Icon placement now lives in render.js, which builds the form from the
   schema and knows which glyph each field, option and step should carry.
   This file only defines the set. */
