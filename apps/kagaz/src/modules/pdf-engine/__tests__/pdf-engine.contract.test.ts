import { pdfEngineContract } from '../types/__contract__/pdf-engine.contract';
import { MockPdfEngineService } from '../services/mock-pdf-engine.service';

pdfEngineContract(async () => {
  return new MockPdfEngineService();
});
