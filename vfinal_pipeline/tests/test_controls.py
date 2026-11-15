"""Additional admitted-input controls; no Soter checkpoints or corpora."""
import copy
from pathlib import Path
import tempfile
import unittest
from test_pipeline import inputs, row


class Controls(unittest.TestCase):
    def test_family_holdout_conflict_and_train_only_quarantine(self):
        from vfinal_pipeline.data_build import build
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            records = [row('d'+str(i),chr(65+i)*15) for i in range(24)]
            records.append(row('leak','FROZEN-CANARY-ZZZ'))
            data = build(inputs(root,rows=records),root/'data')
            self.assertIn({'id':'leak','reason':'holdout_connected'},
                          [{k:q[k] for k in ('id','reason')} for q in data['quarantine']])
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            with self.assertRaisesRegex(ValueError,'contradiction'):
                build(inputs(root,rows=[row('bad','FROZEN-CANARY-ZZZ','PII')]),root/'data')

    def test_full_support_paired_comparison_is_still_not_release(self):
        from vfinal_pipeline.release_gate import default_contract, evaluate
        from eval_harness.core import Case, REQUIRED_SLICES, cases_fingerprint
        rows=[]
        for i in range(400):
            r=row('x'+str(i),'UNIT-ONLY-'+str(i),'SAFE' if i<200 else 'PII')
            r['slices']=list(REQUIRED_SLICES)
            rows.append(r)
        cases=[Case.from_dict(r) for r in rows]
        c=default_contract()
        c['languages']=['en']
        c['bootstrap_samples']=100
        context={'dataset_sha256':cases_fingerprint(cases),'hardware_id':'UNIT-ONLY','preprocessing':'exact',
                 'batch_size':1,'runtime':'unit','sequence_policy':'unit','serving_path':'cpu_service_local'}
        arms=[{'name':n,'model_identity':n,'context':copy.deepcopy(context),'threshold':0.5,
               'case_ids':[r['id'] for r in rows],'scores':[0.01]*200+[0.99]*200,
               'latencies_ms':[1.0]*1000,'evidence_class':'UNIT-ONLY','memory_bytes':1,'size_bytes':1,'cold_load_ms':1.0}
              for n in c['required_models']]
        result=evaluate(rows,arms,c)
        self.assertFalse(result['criteria_pass'])
        self.assertFalse(result['release_ready'])
        self.assertTrue(result['comparisons']['overall']['paired'])
        self.assertFalse(any('insufficient_support' in x for x in result['failures']))

    def test_actual_int8_export_path_tiny_random_linear(self):
        import torch
        from vfinal_pipeline.calibration_export import calibrate, export_onnx
        torch.set_num_threads(1)
        torch.manual_seed(5)
        class Tiny(torch.nn.Module):
            def __init__(self):
                super().__init__()
                self.head=torch.nn.Linear(2,2)
            def forward(self,input_ids,attention_mask):
                x=(input_ids.float()*attention_mask).sum(1)
                return self.head(torch.stack((x,-x),1))
        calibration=calibrate([[2.,-1.],[-1.,2.]],[0,1],split='validation',model_identity='a'*64,data_identity='b'*64,max_fpr=0.0,fit_temperature=False)
        self.assertEqual(calibration['temperature'],1.0)
        examples=[{'input_ids':torch.ones((b,s),dtype=torch.long), 'attention_mask':torch.ones((b,s),dtype=torch.long)}
                  for b,s in [(1,2),(2,3),(1,4)]]
        with tempfile.TemporaryDirectory() as tmp:
            report=export_onnx(Tiny(),examples,calibration,Path(tmp)/'export',unit_only=True,quantize=True)
            self.assertEqual({p['variant'] for p in report['parity']},{'fp32','int8'})
            self.assertFalse(report['release_ready'])


if __name__ == '__main__':
    unittest.main()
