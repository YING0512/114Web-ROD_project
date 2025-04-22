def foo():
    print("start")
    while True:
        res = yield 4 # yield 4 會返回4，並且暫停，等待下一次的send
        print("in foo",res) # 這裡的 res 是 send 的值
g = foo()
print(next(g)) # 啟動 foo，並且返回 4
print("*"*20)
print(next(g)) # 啟動 foo，並且返回 4
print("*"*20)
print(g.send(7)) # 這裡的 7 會傳給 res，並且返回 4