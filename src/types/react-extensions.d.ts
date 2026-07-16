/**
 * Extended HTML Input Attributes
 * 
 * Extends React's InputHTMLAttributes to include non-standard directory attributes
 * used for folder selection in file inputs.
 */

import 'react';

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface InputHTMLAttributes<T> {
    /** Enable directory selection (WebKit browsers) */
    webkitdirectory?: string;
    /** Enable directory selection (Firefox) */
    directory?: string;
  }
}
