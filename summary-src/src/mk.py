import json,sys,importlib.util,os
for f in sys.argv[1:]:
    sp=importlib.util.spec_from_file_location('m',f);m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
    out={'parts':[{'name':p,'ch':[dict({'title':c[0],'sids':c[1],'body':c[2].strip()},**({'skip':c[3]} if len(c)>3 else {})) for c in chs]} for p,chs in m.P]}
    u=os.path.basename(f)[:-3]
    json.dump(out,open(f'../specs/{u}.json','w'),ensure_ascii=False)
    print(u,sum(len(p['ch']) for p in out['parts']),'chapters')
