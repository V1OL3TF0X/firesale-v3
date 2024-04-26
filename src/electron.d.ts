/// <reference types="vite/client" />
/// <reference types="electron" />

import type { ExtraFunctions } from "./preload";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

declare interface Window extends ExtraFunctions {}
