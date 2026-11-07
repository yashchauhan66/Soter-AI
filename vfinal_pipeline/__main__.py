"""python -m vfinal_pipeline --help. No implicit installs or downloads."""
import argparse
from pathlib import Path
from .common import canonical, captured, decode, write_new


def main(argv=None):
    parser = argparse.ArgumentParser(description='Offline v-final experiments; never grants deployment approval')
    sub = parser.add_subparsers(dest='command',required=True)
    for name in ('build','train','teacher-select','export','gate','package'):
        p = sub.add_parser(name)
        p.add_argument('input',help='manifest/config/source directory')
        p.add_argument('output',help='new artifact path (training may auto-resume)')
    p = sub.add_parser('mine')
    p.add_argument('input')
    p.add_argument('model_dir')
    p.add_argument('output')
    p = sub.add_parser('verify')
    p.add_argument('input')
    args = parser.parse_args(argv)
    if args.command == 'build':
        from .data_build import build
        result = build(args.input,args.output)
    elif args.command == 'train':
        from .experiment import run
        result = run(decode(Path(args.input).read_bytes()),args.output)
    elif args.command == 'teacher-select':
        from .experiment import select_teacher
        spec = decode(Path(args.input).read_bytes())
        result = select_teacher(spec['config'],spec['candidates'])
        write_new(args.output,canonical(result))
    elif args.command == 'mine':
        from .experiment import mine
        result = mine(decode(Path(args.input).read_bytes()),args.model_dir)
        write_new(args.output,canonical(result))
    elif args.command == 'export':
        from .experiment import bundle_identity, local_model, resources
        from .calibration_export import export_onnx
        spec = decode(Path(args.input).read_bytes())
        resources(Path(spec['model_dir']),spec['unit_only'])
        calibration = decode(Path(spec['calibration']).read_bytes())
        if bundle_identity(spec['model_dir']) != calibration['model_identity']:
            raise ValueError('export model/calibration identity mismatch')
        model, tokenizer = local_model(spec['model_dir'])
        examples = [dict(tokenizer(text,padding=True,truncation=True,max_length=spec['max_length'],return_tensors='pt'))
                    for text in [['ordinary request'],['ordinary request','a longer ordinary request for support'],
                                 ['ordinary request '*min(64,spec['max_length']//2)]]]
        result = export_onnx(model,examples,calibration,args.output,unit_only=spec['unit_only'],quantize=spec['quantize'])
        tokenizer.save_pretrained(args.output)
        write_new(Path(args.output)/'labels.json',canonical({str(k):v for k,v in model.config.id2label.items()}))
    elif args.command == 'gate':
        from .release_gate import evaluate
        spec_path = Path(args.input)
        spec = decode(spec_path.read_bytes())
        rows = [decode(line) for line in captured(spec_path.parent,spec['cases']).splitlines()]
        arms = [decode(captured(spec_path.parent,p)) for p in spec['arms']]
        result = evaluate(rows,arms,spec['contract'])
        write_new(args.output,canonical(result))
    elif args.command == 'package':
        from .packaging import package
        spec = decode(Path(args.input).read_bytes())
        result = package(spec['source'],args.output,decode(Path(spec['gate']).read_bytes()))
    else:
        from .packaging import verify
        result = verify(args.input)
    print(canonical(result).decode('utf-8'))
    return 2 if args.command == 'gate' and not result['criteria_pass'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
