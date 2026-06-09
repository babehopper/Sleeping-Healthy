import { useState, useEffect } from 'react'
import { Card, Tabs, Form, Input, Button, Avatar, Upload, message, Table, Space, Switch, InputNumber, Modal } from 'antd'
import { User, Upload as UploadIcon, Plus, Trash2, Settings as SettingsIcon } from 'lucide-react'
import { updateUserProfile, getUserProfile, uploadAvatar } from '../api/auth'
import { getDevices, addDevice, deleteDevice } from '../api/devices'
import './Settings.css'

const Settings = () => {
  const [userForm] = Form.useForm()
  const [deviceForm] = Form.useForm()
  const [configModalVisible, setConfigModalVisible] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(null)

  const userId = localStorage.getItem('userId')

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return
      setLoading(true)
      try {
        const userResult = await getUserProfile(userId)
        if (userResult.success) {
          userForm.setFieldsValue({
            username: userResult.data.username || 'admin',
            email: userResult.data.email || 'admin@example.com',
            phone: userResult.data.phone || '13800138000',
            age: userResult.data.age || 25,
            height: userResult.data.height || 175,
            weight: userResult.data.weight || 70
          })
          if (userResult.data.avatar) {
            setAvatarUrl(`http://localhost:5000${userResult.data.avatar}`)
          }
        }

        const deviceResult = await getDevices(userId)
        if (deviceResult.success) {
          setDevices(deviceResult.data.map((d, i) => ({ ...d, key: String(i + 1) })))
        }
      } catch (error) {
        console.error('获取数据失败:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [userId, userForm])

  const handleUserUpdate = async (values) => {
    if (!userId) return
    setLoading(true)
    try {
      const result = await updateUserProfile(userId, values)
      if (result.success) {
        message.success('个人信息更新成功')
        localStorage.setItem('profileUpdated', 'true')
        window.dispatchEvent(new Event('profileUpdated'))
      } else {
        message.error(result.message || '更新失败')
      }
    } catch (error) {
      message.error(error.message || '网络连接失败')
      console.error('更新用户信息失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarUpload = async (file) => {
    if (!userId) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64Data = e.target.result
      try {
        const result = await uploadAvatar(userId, base64Data)
        if (result.success) {
          setAvatarUrl(`http://localhost:5000${result.avatar}`)
          message.success('头像上传成功')
        } else {
          message.error(result.message || '上传失败')
        }
      } catch (error) {
        message.error(error.message || '上传失败')
        console.error('上传头像失败:', error)
      }
    }
    reader.readAsDataURL(file)

    return false
  }

  const handleDeviceAdd = async () => {
    if (!userId) return
    try {
      const values = await deviceForm.validateFields()
      const result = await addDevice(userId, {
        deviceId: values.deviceId,
        name: values.deviceName
      })
      if (result.success) {
        setDevices(prev => [...prev, { ...result.data, key: String(prev.length + 1) }])
        message.success('设备添加成功')
        deviceForm.resetFields()
      } else {
        message.error(result.message || '添加失败')
      }
    } catch (error) {
      message.error(error.message || '添加失败')
      console.error('添加设备失败:', error)
    }
  }

  const handleDeviceDelete = async (key) => {
    const device = devices.find(d => d.key === key)
    if (!device) return
    try {
      const result = await deleteDevice(device.id || device.deviceId)
      if (result.success) {
        setDevices(devices.filter(d => d.key !== key))
        message.success('设备已删除')
      } else {
        message.error(result.message || '删除失败')
      }
    } catch (error) {
      message.error(error.message || '删除失败')
      console.error('删除设备失败:', error)
    }
  }

  const handleDeviceConfig = (record) => {
    setSelectedDevice(record)
    setConfigModalVisible(true)
  }

  const handleConfigSave = () => {
    setConfigModalVisible(false)
    message.success('设备配置已保存')
  }

  const deviceColumns = [
    {
      title: '设备ID',
      dataIndex: 'deviceId',
      key: 'deviceId'
    },
    {
      title: '设备名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const color = status === '在线' ? 'green' : 'red'
        return <span style={{ color }}>{status}</span>
      }
    },
    {
      title: '电量',
      dataIndex: 'battery',
      key: 'battery',
      render: (battery) => `${battery || 0}%`
    },
    {
      title: '信号强度',
      dataIndex: 'signal',
      key: 'signal',
      render: (signal) => signal === 0 || signal === undefined ? '-' : `${signal}dBm`
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<SettingsIcon size={14} />} onClick={() => handleDeviceConfig(record)}>配置</Button>
          <Button 
            type="link" 
            danger
            icon={<Trash2 size={14} />}
            onClick={() => handleDeviceDelete(record.key)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ]

  const tabItems = [
    {
      key: '1',
      label: '个人信息',
      children: (
        <Card loading={loading}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Avatar size={80} src={avatarUrl} icon={<User size={32} />} style={{ backgroundColor: '#1a6340' }} />
            <div style={{ marginTop: '16px' }}>
              <Upload beforeUpload={handleAvatarUpload}>
                <Button icon={<UploadIcon size={16} />}>更换头像</Button>
              </Upload>
            </div>
          </div>
          <Form
            form={userForm}
            layout="vertical"
            onFinish={handleUserUpdate}
          >
            <Form.Item label="用户名" name="username">
              <Input />
            </Form.Item>
            <Form.Item label="邮箱" name="email">
              <Input type="email" />
            </Form.Item>
            <Form.Item label="手机号" name="phone">
              <Input />
            </Form.Item>
            <Form.Item label="年龄" name="age">
              <InputNumber min={1} max={120} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="身高(cm)" name="height">
              <InputNumber min={50} max={250} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="体重(kg)" name="weight">
              <InputNumber min={20} max={300} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>
                保存修改
              </Button>
            </Form.Item>
          </Form>
        </Card>
      )
    },
    {
      key: '2',
      label: '设备管理',
      children: (
        <Card loading={loading}>
          <div style={{ marginBottom: '16px' }}>
            <Form form={deviceForm} layout="inline">
              <Form.Item 
                name="deviceId" 
                rules={[{ required: true, message: '请输入设备ID' }]}
              >
                <Input placeholder="设备ID" style={{ width: 200 }} />
              </Form.Item>
              <Form.Item 
                name="deviceName"
                rules={[{ required: true, message: '请输入设备名称' }]}
              >
                <Input placeholder="设备名称" style={{ width: 200 }} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" icon={<Plus size={16} />} onClick={handleDeviceAdd} loading={loading}>
                  添加设备
                </Button>
              </Form.Item>
            </Form>
          </div>
          <Table columns={deviceColumns} dataSource={devices.length > 0 ? devices : [
            {
              key: '1',
              deviceId: 'ESP-001',
              name: '卧室监测设备',
              status: '在线',
              battery: 85,
              signal: -65
            },
            {
              key: '2',
              deviceId: 'ESP-002',
              name: '客厅监测设备',
              status: '离线',
              battery: 0,
              signal: 0
            }
          ]} pagination={false} />
        </Card>
      )
    },
    {
      key: '3',
      label: '系统设置',
      children: (
        <Card>
          <Form layout="vertical">
            <Form.Item label="数据采集频率">
              <InputNumber 
                addonAfter="秒" 
                defaultValue={30} 
                min={10} 
                max={300}
                style={{ width: 200 }}
              />
            </Form.Item>
            <Form.Item label="睡眠报告自动生成">
              <Switch defaultChecked />
            </Form.Item>
            <Form.Item label="实时数据推送">
              <Switch defaultChecked />
            </Form.Item>
            <Form.Item label="数据保留时长">
              <InputNumber 
                addonAfter="天" 
                defaultValue={90} 
                min={30} 
                max={365}
                style={{ width: 200 }}
              />
            </Form.Item>
            <Form.Item>
              <Button type="primary">保存设置</Button>
            </Form.Item>
          </Form>
        </Card>
      )
    }
  ]

  return (
    <div className="settings">
      <h2>系统设置</h2>
      <Tabs items={tabItems} />
      
      <Modal
        title={`设备配置 - ${selectedDevice?.name}`}
        open={configModalVisible}
        onCancel={() => setConfigModalVisible(false)}
        footer={[
          <Button key="back" onClick={() => setConfigModalVisible(false)}>取消</Button>,
          <Button key="submit" type="primary" onClick={handleConfigSave}>保存配置</Button>
        ]}
      >
        <Form layout="vertical">
          <Form.Item label="设备名称">
            <Input defaultValue={selectedDevice?.name} />
          </Form.Item>
          <Form.Item label="采样频率">
            <InputNumber addonAfter="Hz" defaultValue={10} min={1} max={100} />
          </Form.Item>
          <Form.Item label="信号阈值">
            <InputNumber addonAfter="dBm" defaultValue={-70} min={-100} max={0} />
          </Form.Item>
          <Form.Item label="告警开关">
            <Switch defaultChecked />
          </Form.Item>
          <Form.Item label="数据上传">
            <Switch defaultChecked />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Settings