import ast
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from test_pipeline import inputs, module


class Entrypoints(unittest.TestCase):
    def test_cli_build_and_colab_notebook_is_valid_python(self):
        module(self, '__main__')
        root = Path(__file__).resolve().parents[2]
        help_run = subprocess.run([sys.executable,'-B','-m','vfinal_pipeline','--help'],cwd=root,capture_output=True,text=True)
        self.assertEqual(help_run.returncode,0,help_run.stderr)
        for verb in ['build','train','mine','teacher-select','export','gate','package','verify']:
            self.assertIn(verb,help_run.stdout)
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp)
            spec = inputs(p)
            run = subprocess.run([sys.executable,'-B','-m','vfinal_pipeline','build',str(spec),str(p/'data')],cwd=root,capture_output=True,text=True)
            self.assertEqual(run.returncode,0,run.stderr)
            self.assertFalse(json.loads(run.stdout)['release_ready'])
        notebook = root/'notebooks/v-final/01_t4_execution.ipynb'
        self.assertTrue(notebook.is_file(),'runnable Colab notebook is missing')
        import nbformat
        book = nbformat.read(notebook,as_version=4)
        nbformat.validate(book)
        for i,cell in enumerate(book.cells):
            if cell.cell_type == 'code':
                ast.parse(cell.source,filename=f'cell-{i}')
                self.assertEqual(cell.execution_count,None)
                self.assertEqual(cell.outputs,[])
        self.assertIn('drive.mount',notebook.read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()
