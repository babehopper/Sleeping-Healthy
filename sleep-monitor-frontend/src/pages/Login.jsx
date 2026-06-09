import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Form, Input, Button, message } from 'antd'
import { Moon } from 'lucide-react'
import { login } from '../api/auth'
import './Login.css'

const Login = () => {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const onFinish = async (values) => {
    setLoading(true)
    try {
      const data = await login(values.username, values.password)
      if (data.success) {
        message.success('登录成功！')
        localStorage.setItem('userId', data.user.id)
        localStorage.setItem('username', data.user.username)
        navigate('/dashboard')
      } else {
        message.error(data.message || '登录失败！')
      }
    } catch (error) {
      message.error('网络连接失败，请稍后重试！')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-right">
        <div className="auth-form-box">
          <div className="auth-card-left">
            <Moon size={48} />
            <h2>睡眠监测系统</h2>
            <p>无接触 · 无感知</p>
            <p>更懂你的睡眠</p>
            <span className="tagline">SLEEP MONITOR</span>
          </div>
          <div className="auth-card-right">
            <h3>欢迎回来</h3>
            <p className="sub">请登录您的账户</p>
            <Form name="login" onFinish={onFinish} autoComplete="off" size="large">
              <Form.Item name="username" rules={[{ required: true, message: '请输入用户名！' }]}>
                <Input placeholder="用户名" />
              </Form.Item>
              <Form.Item name="password" rules={[{ required: true, message: '请输入密码！' }]}>
                <Input.Password placeholder="密码" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block className="auth-btn">
                  登 录
                </Button>
              </Form.Item>
            </Form>
            <div className="auth-footer">
              还没有账号？ <Link to="/register">立即注册</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login