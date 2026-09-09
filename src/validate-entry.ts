import {stateSchema} from './marketing-schema'; export const validateMarketing=(state:unknown)=>stateSchema.parse(state);
