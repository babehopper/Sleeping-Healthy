import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Form, Input, Button, message } from 'antd'
import { Moon } from 'lucide-react'
import { register } from '../api/auth'
import './Login.css'

const Register = () => {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const onFinish = async (values) => {
    setLoading(true)
    try {
      const data = await register(values)
      if (data.success) {
        message.success('注册成功！请登录')
        navigate('/login')
      } else {
        message.error(data.message || '注册失败！')
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
            <h3>创建账户</h3>
            <p className="sub">加入睡眠监测系统</p>
            <Form name="register" onFinish={onFinish} autoComplete="off" size="large">
              <Form.Item name="username" rules={[{ required: true, message: '请输入用户名！' }]}>
                <Input placeholder="用户名" />
              </Form.Item>
              <Form.Item name="email" rules={[
                { required: true, message: '请输入邮箱！' },
                { type: 'email', message: '请输入有效的邮箱！' },
              ]}>
                <Input placeholder="邮箱" />
              </Form.Item>
              <Form.Item name="phone" rules={[{ required: true, message: '请输入手机号！' }]}>
                <Input placeholder="手机号" />
              </Form.Item>
              <Form.Item name="password" rules={[
                { required: true, message: '请输入密码！' },
                { min: 6, message: '密码至少6位！' },
              ]}>
                <Input.Password placeholder="密码" />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                dependencies={['password']}
                rules={[
                  { required: true, message: '请确认密码！' },
                  function validator(_ref) {
                    var getFieldValue = _ref.getFieldValue
                    return {
                      validator: function check(_rule, value) {
                        if (!value || getFieldValue('password') === value) {
                          return Promise.resolve()
                        }
                        return Promise.reject(new Error('两次输入的密码不一致！'))
                      },
                    }
                  },
                ]}
              >
                <Input.Password placeholder="确认密码" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block className="auth-btn">
                  注 册
                </Button>
              </Form.Item>
            </Form>
            <div className="auth-footer">
              已有账号？ <Link to="/login">立即登录</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register