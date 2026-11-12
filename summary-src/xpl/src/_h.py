def x(p, t, g, c, s, w, o, k, m, st, sw, tr="", tb=None, am="", un="", v=None, er=""):
    d = dict(p=p, t=t, g=g, c=c, s=s, w=w, o=o, k=k, m=m, st=st, sw=sw)
    if tr: d['tr'] = tr
    if tb: d['tb'] = tb
    if am: d['am'] = am
    if un: d['un'] = un
    if v: d['v'] = v
    if er: d['er'] = er
    return d
